import { Router } from "express";
import {
  createBooking,
  getMyBookings,
  getHostBookings,
  getStudioBookings,
  updateBookingStatus,
  cancelBooking,
} from "../controllers/booking.controller";
import { verifyToken } from "../middleware/verifyToken";

const router = Router();

router.get("/host", verifyToken, getHostBookings);
router.get("/mine", verifyToken, getMyBookings);
router.get("/studio/:id", getStudioBookings);

router.post("/", verifyToken, createBooking); // Challenge 1: protected
router.patch("/:id/status", verifyToken, updateBookingStatus);
router.delete("/:id", verifyToken, cancelBooking);

export default router;
