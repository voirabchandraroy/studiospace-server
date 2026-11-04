import { Router } from "express";
import { getWishlist, toggleWishlist } from "../controllers/wishlist.controller";
import { verifyToken } from "../middleware/verifyToken";

const router = Router();

router.get("/", verifyToken, getWishlist);
router.post("/toggle", verifyToken, toggleWishlist);

export default router;
