import { ObjectId } from "mongodb";

export interface UserDoc {
  _id?: ObjectId;
  name: string;
  email: string;
  photoURL?: string;
  password?: string;
  provider: "credentials" | "google";
  createdAt: Date;
}

export type StudioCategory =
  | "Photo Studio"
  | "Film Stage"
  | "Podcast Lounge"
  | "Music Suite"
  | "Art Workshop";

export interface StudioDoc {
  _id?: ObjectId;
  title: string;
  category: string;
  hourlyRate: number;
  securityDeposit: number;
  maxCapacity: number;
  location: string;
  image: string;
  gallery: string[];
  amenities: string[];
  overview: string;
  rating: number;
  reviewCount: number;
  ownerEmail: string;
  ownerName: string;
  createdAt: Date;
}

export type BookingStatus = "Pending" | "Confirmed" | "Completed" | "Cancelled";

export interface BookingDoc {
  _id?: ObjectId;
  studioId: string;
  studioTitle: string;
  studioImage: string;
  location: string;
  hourlyRate: number;
  userEmail: string;
  userName: string;
  userPhoto?: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  hours: number;
  totalCost: number;
  note?: string;
  status: BookingStatus;
  createdAt: Date;
}
