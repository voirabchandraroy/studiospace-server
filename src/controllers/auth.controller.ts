import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { ObjectId } from "mongodb";
import { collections } from "../config/db";
import { UserDoc } from "../types";
import { signToken, verifyJwt, cookieOptions, COOKIE_NAME } from "../lib/jwt";

const safeUser = (user: UserDoc) => ({
  _id: user._id?.toString(),
  name: user.name,
  email: user.email,
  photoURL: user.photoURL || "",
  provider: user.provider,
  createdAt: user.createdAt,
});

/** POST /api/auth/register */
export const registerUser = async (req: Request, res: Response) => {
  try {
    const { name, email, photoURL, password } = req.body as {
      name?: string;
      email?: string;
      photoURL?: string;
      password?: string;
    };

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email and password are required." });
    }

    // Server-side password rules (same three checks as the registration form)
    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters long." });
    }
    if (!/[A-Z]/.test(password)) {
      return res
        .status(400)
        .json({ message: "Password must contain at least one uppercase letter." });
    }
    if (!/[a-z]/.test(password)) {
      return res
        .status(400)
        .json({ message: "Password must contain at least one lowercase letter." });
    }

    const existing = await collections.users().findOne({ email });
    if (existing) {
      return res.status(409).json({ message: "This email is already registered." });
    }

    const hashed = await bcrypt.hash(password, 10);

    const newUser: UserDoc = {
      name,
      email,
      photoURL: photoURL || "",
      password: hashed,
      provider: "credentials",
      createdAt: new Date(),
    };

    const result = await collections.users().insertOne(newUser);

    return res.status(201).json({
      message: "Registration successful. Please log in.",
      user: safeUser({ ...newUser, _id: result.insertedId }),
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to register user." });
  }
};

/** POST /api/auth/login */
export const loginUser = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const user = (await collections.users().findOne({ email })) as UserDoc | null;
    if (!user) {
      return res.status(404).json({ message: "No account found with this email." });
    }

    if (!user.password) {
      return res
        .status(400)
        .json({ message: "This account uses Google sign-in. Please continue with Google." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Incorrect password. Please try again." });
    }

    const token = signToken({ email: user.email, name: user.name });
    res.cookie(COOKIE_NAME, token, cookieOptions);

    return res.status(200).json({ message: "Login successful.", user: safeUser(user) });
  } catch (error) {
    return res.status(500).json({ message: "Failed to log in." });
  }
};

/** POST /api/auth/google — Google / social login */
export const googleLogin = async (req: Request, res: Response) => {
  try {
    const { name, email, photoURL } = req.body as {
      name?: string;
      email?: string;
      photoURL?: string;
    };

    if (!email) return res.status(400).json({ message: "Email is required." });

    let user = (await collections.users().findOne({ email })) as UserDoc | null;

    if (!user) {
      const newUser: UserDoc = {
        name: name || email.split("@")[0],
        email,
        photoURL: photoURL || "",
        provider: "google",
        createdAt: new Date(),
      };
      const result = await collections.users().insertOne(newUser);
      user = { ...newUser, _id: result.insertedId };
    }

    const token = signToken({ email: user.email, name: user.name });
    res.cookie(COOKIE_NAME, token, cookieOptions);

    return res.status(200).json({ message: "Google login successful.", user: safeUser(user) });
  } catch (error) {
    return res.status(500).json({ message: "Google authentication failed." });
  }
};

/** POST /api/auth/logout */
export const logoutUser = async (_req: Request, res: Response) => {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: (process.env.NODE_ENV === "production" ? "none" : "lax") as
      | "none"
      | "lax"
      | "strict",
    path: "/",
  });
  return res.status(200).json({ message: "Logged out successfully." });
};

/** GET /api/auth/me — keeps the user logged in on full page reload */
export const getMe = async (req: Request, res: Response) => {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) return res.status(401).json({ message: "Unauthorized access." });

    const decoded = verifyJwt(token);
    const user = (await collections
      .users()
      .findOne({ email: decoded.email })) as UserDoc | null;

    if (!user) return res.status(404).json({ message: "User not found." });

    return res.status(200).json(safeUser(user));
  } catch (error) {
    return res.status(401).json({ message: "Unauthorized access." });
  }
};
