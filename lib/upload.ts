// M10: Cloudinary-সার্ভার-আপলোড (নোট ৫০ — শুধু-সার্ভার; গার্ড API-তেই; folder-প্যারামেট্রিজড)
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const UPLOAD_TYPES = [
  "application/pdf", "image/png", "image/jpeg", "image/webp", "text/plain",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip",
];
export const UPLOAD_MAX_BYTES = 10 * 1024 * 1024; // ১০MB

export async function saveUpload(file: File, folder: string): Promise<string> {
  if (!UPLOAD_TYPES.includes(file.type)) throw new Error("INVALID_TYPE");
  if (file.size > UPLOAD_MAX_BYTES) throw new Error("TOO_LARGE");
  const buf = Buffer.from(await file.arrayBuffer());
  const res = await new Promise<{ secure_url: string }>((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      { folder, resource_type: "auto" },
      (err, r) => (err || !r ? reject(err ?? new Error("upload-failed")) : resolve(r as { secure_url: string })),
    ).end(buf);
  });
  return res.secure_url;
}
