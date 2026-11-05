import { Response } from "express";
import { ObjectId, Sort } from "mongodb";
import { collections } from "../config/db";
import { StudioDoc } from "../types";
import { AuthRequest } from "../middleware/verifyToken";

const toStudio = (doc: StudioDoc) => ({ ...doc, _id: doc._id?.toString() });

/** GET /api/studios/featured — top 6 rated / newest */
export const getFeaturedStudios = async (_req: AuthRequest, res: Response) => {
  try {
    const studios = (await collections
      .studios()
      .find({})
      .sort({ rating: -1, createdAt: -1 } as Sort)
      .limit(6)
      .toArray()) as unknown as StudioDoc[];

    return res.status(200).json(studios.map(toStudio));
  } catch (error) {
    return res.status(500).json({ message: "Failed to load featured studios." });
  }
};

/** GET /api/studios?category=&search=&sort=&page=&limit= */
export const getStudios = async (req: AuthRequest, res: Response) => {
  try {
    const { category, search, sort = "newest", page = "1", limit = "9" } = req.query as Record<
      string,
      string
    >;

    const filter: Record<string, unknown> = {};

    if (category && category !== "All") {
      // Tolerant match so "Photo Studio" and "Photo Studios" both hit the same
      // listings — whichever wording a link or chip happens to use.
      const escaped = category
        .trim()
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        .replace(/\s+/g, "\\s+")
        .replace(/s$/i, "");
      filter.category = { $regex: new RegExp(`^${escaped}s?$`, "i") };
    }
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { location: { $regex: search, $options: "i" } },
        { overview: { $regex: search, $options: "i" } },
      ];
    }

    const sortOption: Sort =
      sort === "price-asc"
        ? { hourlyRate: 1 }
        : sort === "price-desc"
        ? { hourlyRate: -1 }
        : sort === "rating"
        ? { rating: -1 }
        : { createdAt: -1 };

    const pageNumber = Number(page) || 1;
    const pageSize = Number(limit) || 9;
    const skip = (pageNumber - 1) * pageSize;

    const [studios, total] = await Promise.all([
      collections
        .studios()
        .find(filter)
        .sort(sortOption)
        .skip(skip)
        .limit(pageSize)
        .toArray() as unknown as Promise<StudioDoc[]>,
      collections.studios().countDocuments(filter),
    ]);

    return res.status(200).json({
      studios: studios.map(toStudio),
      total,
      page: pageNumber,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load studios." });
  }
};

/** GET /api/studios/mine — listings owned by the logged-in host */
export const getMyStudios = async (req: AuthRequest, res: Response) => {
  try {
    const studios = (await collections
      .studios()
      .find({ ownerEmail: req.user!.email })
      .sort({ createdAt: -1 })
      .toArray()) as unknown as StudioDoc[];

    return res.status(200).json(studios.map(toStudio));
  } catch (error) {
    return res.status(500).json({ message: "Failed to load your listings." });
  }
};

/** GET /api/studios/:id */
export const getStudioById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid studio id." });
    }

    const studio = (await collections
      .studios()
      .findOne({ _id: new ObjectId(id) })) as unknown as StudioDoc | null;

    if (!studio) return res.status(404).json({ message: "Studio not found." });

    const reviews = await collections
      .bookings()
      .find({ studioId: id, status: "Completed" })
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray();

    return res.status(200).json({ ...toStudio(studio), reviews });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load studio details." });
  }
};

/** POST /api/studios — protected by HTTPOnly JWT cookie */
export const createStudio = async (req: AuthRequest, res: Response) => {
  try {
    const {
      title,
      category,
      hourlyRate,
      securityDeposit,
      maxCapacity,
      location,
      image,
      gallery,
      amenities,
      overview,
    } = req.body;

    if (!title || !category || !hourlyRate || !location || !image) {
      return res
        .status(400)
        .json({ message: "Title, category, rate, location and image are required." });
    }

    const newStudio: StudioDoc = {
      title,
      category,
      hourlyRate: Number(hourlyRate),
      securityDeposit: Number(securityDeposit) || 0,
      maxCapacity: Number(maxCapacity) || 1,
      location,
      image,
      gallery: Array.isArray(gallery) ? gallery.filter(Boolean) : [],
      amenities: Array.isArray(amenities) ? amenities : [],
      overview: overview || "",
      rating: 0,
      reviewCount: 0,
      ownerEmail: req.user!.email,
      ownerName: req.user!.name,
      createdAt: new Date(),
    };

    const result = await collections.studios().insertOne(newStudio);

    return res.status(201).json({
      message: "Studio listed successfully.",
      studio: toStudio({ ...newStudio, _id: result.insertedId }),
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to create studio listing." });
  }
};

/** PATCH /api/studios/:id — owner only */
export const updateStudio = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid studio id." });
    }

    const studio = (await collections
      .studios()
      .findOne({ _id: new ObjectId(id) })) as unknown as StudioDoc | null;

    if (!studio) return res.status(404).json({ message: "Studio not found." });

    if (studio.ownerEmail !== req.user!.email) {
      return res
        .status(403)
        .json({ message: "Forbidden — you can only edit your own listings." });
    }

    const allowed = [
      "title",
      "category",
      "hourlyRate",
      "securityDeposit",
      "maxCapacity",
      "location",
      "image",
      "gallery",
      "amenities",
      "overview",
    ];

    const update: Record<string, unknown> = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }
    if (update.hourlyRate) update.hourlyRate = Number(update.hourlyRate);
    if (update.securityDeposit) update.securityDeposit = Number(update.securityDeposit);
    if (update.maxCapacity) update.maxCapacity = Number(update.maxCapacity);

    const result = await collections
      .studios()
      .findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: update },
        { returnDocument: "after" }
      );

    return res.status(200).json({
      message: "Studio updated successfully.",
      studio: toStudio(result as unknown as StudioDoc),
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update studio." });
  }
};

/** DELETE /api/studios/:id — owner only */
export const deleteStudio = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid studio id." });
    }

    const studio = (await collections
      .studios()
      .findOne({ _id: new ObjectId(id) })) as unknown as StudioDoc | null;

    if (!studio) return res.status(404).json({ message: "Studio not found." });

    if (studio.ownerEmail !== req.user!.email) {
      return res
        .status(403)
        .json({ message: "Forbidden — you can only delete your own listings." });
    }

    await collections.studios().deleteOne({ _id: new ObjectId(id) });

    return res.status(200).json({ message: "Studio listing deleted successfully." });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete studio." });
  }
};
