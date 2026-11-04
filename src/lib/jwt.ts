import jwt, { SignOptions } from "jsonwebtoken";

export const COOKIE_NAME = "token";

export interface JwtPayload {
  email: string;
  name: string;
}

export function signToken(payload: JwtPayload): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is missing in .env");
  return jwt.sign(payload, secret, {
    expiresIn: (process.env.JWT_EXPIRES_IN || "7d") as SignOptions["expiresIn"],
  });
}

export function verifyJwt(token: string): JwtPayload {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is missing in .env");
  return jwt.verify(token, secret) as JwtPayload;
}

/** HTTPOnly cookie options — Challenge 1 (JWT security) */
export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: (process.env.NODE_ENV === "production" ? "none" : "lax") as
    | "none"
    | "lax"
    | "strict",
  path: "/",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};
