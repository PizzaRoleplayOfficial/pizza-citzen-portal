export type CatalogData = {
  carModels: Record<string, string[]>;
  carTrims: string[];
  carColors: string[];
};

export type VehicleStatus = "approved" | "pending" | "rejected" | "approved_warning" | "temp_approved";

export interface Vehicle {
  id: string;
  owner_id: string;
  maker: string;
  model: string;
  year: number;
  trim: string;
  color: string;
  plate: string;
  plate_region: string;
  status: VehicleStatus;
  reject_reason?: string;
  created_at?: string;
  reviewed_at?: string;
  roblox_username: string;
  discord_username?: string;
  discord_avatar?: string;
  image_data?: string;
  temp_plate?: string;
  temp_expires_at?: string;
  is_temp_registration?: number;
}

export interface User {
  id: string;
  username: string;
  avatar: string;
  role: "user" | "admin";
  roblox_username?: string;
}

export interface Application {
  id: string;
  owner_id: string;
  discord_id: string;
  roblox_id: string;
  roblox_username: string;
  status: "pending" | "approved" | "rejected" | "banned";
  created_at: string;
  citizen_name?: string;
  birth_date?: string;
  origin?: string;
  residence?: string;
  gender?: string;
  job?: string;
  licenses?: string[];
}

