type LoaderParams = {
  src: string;
  width: number;
  quality?: number;
};

export default function cloudinaryLoader({
  src,
  width,
  quality,
}: LoaderParams): string {
  if (src.includes("res.cloudinary.com")) {
    const q = quality ?? 75;
    return src.replace("/upload/", `/upload/w_${width},q_${q},f_auto/`);
  }
  // Fallback for non-Cloudinary URLs (placeholders, etc.)
  return src;
}
