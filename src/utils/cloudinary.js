const { v2: cloudinary } = require("cloudinary");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function uploadBuffer(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "food-marketplace/meals", resource_type: "image" },
      (error, result) => (error ? reject(error) : resolve(result))
    );
    stream.end(buffer);
  });
}

// Uploads every multer file; returns rows ready for prisma's `images.create`
async function uploadFiles(files) {
  const results = await Promise.all(files.map((f) => uploadBuffer(f.buffer)));
  return results.map((r) => ({ imageUrl: r.secure_url, publicId: r.public_id }));
}

// Best-effort delete: never throws, so a cleanup failure can't break a request
async function deleteImage(publicId) {
  if (!publicId) return; // old local-disk images have no publicId
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.error(`Failed to delete Cloudinary image ${publicId}:`, err.message);
  }
}

module.exports = { uploadFiles, deleteImage };