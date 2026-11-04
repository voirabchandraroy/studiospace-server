import { Router } from "express";
import {
  registerUser,
  loginUser,
  googleLogin,
  logoutUser,
  getMe,
} from "../controllers/auth.controller";

const router = Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/google", googleLogin);
router.post("/logout", logoutUser);
router.get("/me", getMe);

export default router;
