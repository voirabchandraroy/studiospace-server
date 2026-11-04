import { Response } from "express";
import { ObjectId } from "mongodb";
import { collections } from "../config/db";
import { AuthRequest } from "../middleware/verifyToken";

/** GET /api/wishlist — ids of studios the user hearted */
export const getWishlist = async (req: AuthRequest, res: Response) => {
  try {
    const items = await collections
      .wishlist()
      .find({ userEmail: req.user!.email })
      .toArray();

    return res.status(200).json(items.map((i) => i.studioId));
  } catch (error) {
    return res.status(500).json({ message: "Failed to load wishlist." });
  }
};

/** POST /api/wishlist/toggle  { studioId } */
export const toggleWishlist = async (req: AuthRequest, res: Response) => {
  try {
    const { studioId } = req.body as { studioId?: string };
    if (!studioId) return res.status(400).json({ message: "studioId is required." });

    const email = req.user!.email;
    const existing = await collections.wishlist().findOne({ userEmail: email, studioId });

    if (existing) {
      await collections.wishlist().deleteOne({ userEmail: email, studioId });
      return res.status(200).json({ saved: false, message: "Removed from your saved studios." });
    }

    await collections.wishlist().insertOne({
      userEmail: email,
      studioId,
      createdAt: new Date(),
    });

    return res.status(201).json({ saved: true, message: "Added to your saved studios." });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update wishlist." });
  }
};
