import { Router } from "express";
import {
  getFeaturedStudios,
  getStudios,
  getMyStudios,
  getStudioById,
  createStudio,
  updateStudio,
  deleteStudio,
} from "../controllers/studio.controller";
import { verifyToken } from "../middleware/verifyToken";

const router = Router();

// Static paths must be declared BEFORE /:id
router.get("/featured", getFeaturedStudios);
router.get("/mine", verifyToken, getMyStudios);

router.get("/", getStudios);
router.post("/", verifyToken, createStudio); // Challenge 1: protected

router.get("/:id", getStudioById);
router.patch("/:id", verifyToken, updateStudio); // Challenge 1: protected
router.delete("/:id", verifyToken, deleteStudio); // Challenge 1: protected

export default router;
