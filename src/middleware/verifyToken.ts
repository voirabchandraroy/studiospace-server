import { Request, Response, NextFunction } from "express";
import { verifyJwt, JwtPayload } from "../lib/jwt";

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

/**
 * Challenge 1: every server-side mutation is guarded by this middleware.
 * The JWT lives in an HTTPOnly cookie, so client JS can never read it.
 * Rejects with 401 Unauthorized when the cookie is missing / invalid / expired.
 */
export function verifyToken(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.token;

  if (!token) {
    return res
      .status(401)
      .json({ message: "Unauthorized access — please log in first." });
  }

  try {
    req.user = verifyJwt(token);
    next();
  } catch (error) {
    return res
      .status(401)
      .json({ message: "Unauthorized access — your session has expired." });
  }
}
