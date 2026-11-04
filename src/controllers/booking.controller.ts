import { Response } from "express";
import { ObjectId } from "mongodb";
import { collections } from "../config/db";
import { BookingDoc, StudioDoc } from "../types";
import { AuthRequest } from "../middleware/verifyToken";

const toBooking = (doc: BookingDoc) => ({ ...doc, _id: doc._id?.toString() });

/** "14:30" -> 870 minutes */
const toMinutes = (time: string): number => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m || 0);
};

/**
 * Challenge 2 — double-booking prevention.
 * Two ranges collide when: existing.start < new.end && existing.end > new.start
 */
const hasOverlap = (
  existing: { startTime: string; endTime: string },
  start: string,
  end: string
): boolean => toMinutes(existing.startTime) < toMinutes(end) && toMinutes(existing.endTime) > toMinutes(start);

/** POST /api/bookings */
export const createBooking = async (req: AuthRequest, res: Response) => {
  try {
    const { studioId, date, startTime, endTime, note } = req.body as {
      studioId?: string;
      date?: string;
      startTime?: string;
      endTime?: string;
      note?: string;
    };

    if (!studioId || !date || !startTime || !endTime) {
      return res.status(400).json({ message: "Studio, date and time range are required." });
    }
    if (!ObjectId.isValid(studioId)) {
      return res.status(400).json({ message: "Invalid studio id." });
    }

    if (toMinutes(endTime) <= toMinutes(startTime)) {
      return res
        .status(400)
        .json({ message: "End time must be later than the start time." });
    }

    const studio = (await collections
      .studios()
      .findOne({ _id: new ObjectId(studioId) })) as unknown as StudioDoc | null;

    if (!studio) return res.status(404).json({ message: "Studio not found." });

    if (studio.ownerEmail === req.user!.email) {
      return res
        .status(400)
        .json({ message: "You cannot book your own studio space." });
    }

    const confirmed = (await collections
      .bookings()
      .find({ studioId, date, status: "Confirmed" })
      .toArray()) as unknown as BookingDoc[];

    const collision = confirmed.find((b) => hasOverlap(b, startTime, endTime));
    if (collision) {
      return res.status(409).json({
        message: `This studio is already booked on ${date} from ${collision.startTime} to ${collision.endTime}. Please pick another slot.`,
      });
    }

    const hours = (toMinutes(endTime) - toMinutes(startTime)) / 60;

    const booking: BookingDoc = {
      studioId,
      studioTitle: studio.title,
      studioImage: studio.image,
      location: studio.location,
      hourlyRate: studio.hourlyRate,
      userEmail: req.user!.email,
      userName: req.user!.name,
      date,
      startTime,
      endTime,
      hours,
      totalCost: hours * studio.hourlyRate,
      note: note || "",
      status: "Pending",
      createdAt: new Date(),
    };

    const result = await collections.bookings().insertOne(booking);

    return res.status(201).json({
      message: "Booking request sent. Status: Pending.",
      booking: toBooking({ ...booking, _id: result.insertedId }),
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to create booking." });
  }
};

/** GET /api/bookings?email= — my bookings (or host inbox) */
export const getMyBookings = async (req: AuthRequest, res: Response) => {
  try {
    const bookings = (await collections
      .bookings()
      .find({ userEmail: req.user!.email })
      .sort({ createdAt: -1 })
      .toArray()) as unknown as BookingDoc[];

    return res.status(200).json(bookings.map(toBooking));
  } catch (error) {
    return res.status(500).json({ message: "Failed to load bookings." });
  }
};

/** GET /api/bookings/host — reservation requests for my studios */
export const getHostBookings = async (req: AuthRequest, res: Response) => {
  try {
    const mine = (await collections
      .studios()
      .find({ ownerEmail: req.user!.email })
      .toArray()) as unknown as StudioDoc[];

    const ids = mine.map((s) => s._id?.toString());

    const bookings = (await collections
      .bookings()
      .find({ studioId: { $in: ids } })
      .sort({ createdAt: -1 })
      .toArray()) as unknown as BookingDoc[];

    return res.status(200).json(bookings.map(toBooking));
  } catch (error) {
    return res.status(500).json({ message: "Failed to load host bookings." });
  }
};

/** GET /api/bookings/studio/:id — taken slots (public, for the calendar) */
export const getStudioBookings = async (req: AuthRequest, res: Response) => {
  try {
    const bookings = (await collections
      .bookings()
      .find({ studioId: req.params.id, status: { $in: ["Confirmed", "Pending"] } })
      .toArray()) as unknown as BookingDoc[];

    return res.status(200).json(bookings.map(toBooking));
  } catch (error) {
    return res.status(500).json({ message: "Failed to load studio availability." });
  }
};

/** PATCH /api/bookings/:id/status  { status } */
export const updateBookingStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body as { status?: string };

    const allowed = ["Pending", "Confirmed", "Completed", "Cancelled"];
    if (!status || !allowed.includes(status)) {
      return res.status(400).json({ message: "Invalid booking status." });
    }
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid booking id." });
    }

    const booking = (await collections
      .bookings()
      .findOne({ _id: new ObjectId(id) })) as unknown as BookingDoc | null;

    if (!booking) return res.status(404).json({ message: "Booking not found." });

    // The guest may only cancel their own booking; the host may manage any of theirs.
    const studio = (await collections.studios().findOne({
      _id: new ObjectId(booking.studioId),
    })) as unknown as StudioDoc | null;

    const isGuest = booking.userEmail === req.user!.email;
    const isHost = studio?.ownerEmail === req.user!.email;

    if (!isGuest && !isHost) {
      return res.status(403).json({ message: "Forbidden — not your booking." });
    }

    // Re-check conflicts when a host confirms a slot.
    if (status === "Confirmed") {
      const conflicts = (await collections
        .bookings()
        .find({
          studioId: booking.studioId,
          date: booking.date,
          status: "Confirmed",
          _id: { $ne: new ObjectId(id) },
        })
        .toArray()) as unknown as BookingDoc[];

      const collision = conflicts.find((b) =>
        hasOverlap(b, booking.startTime, booking.endTime)
      );
      if (collision) {
        return res.status(409).json({
          message: `Cannot confirm — overlaps a confirmed booking (${collision.startTime}–${collision.endTime}).`,
        });
      }
    }

    const result = await collections
      .bookings()
      .findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: { status } },
        { returnDocument: "after" }
      );

    return res.status(200).json({
      message: `Booking marked as ${status}.`,
      booking: toBooking(result as unknown as BookingDoc),
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update booking status." });
  }
};

/** DELETE /api/bookings/:id — guest cancels a Pending booking */
export const cancelBooking = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid booking id." });
    }

    const booking = (await collections
      .bookings()
      .findOne({ _id: new ObjectId(id) })) as unknown as BookingDoc | null;

    if (!booking) return res.status(404).json({ message: "Booking not found." });

    if (booking.userEmail !== req.user!.email) {
      return res.status(403).json({ message: "Forbidden — not your booking." });
    }

    if (booking.status !== "Pending") {
      return res
        .status(400)
        .json({ message: `Only pending bookings can be cancelled (current: ${booking.status}).` });
    }

    await collections.bookings().deleteOne({ _id: new ObjectId(id) });

    return res.status(200).json({ message: "Booking cancelled successfully." });
  } catch (error) {
    return res.status(500).json({ message: "Failed to cancel booking." });
  }
};
