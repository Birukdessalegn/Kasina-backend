const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Ensure upload directories exist
const createDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const productsUploadDir = path.join(__dirname, "../../uploads/products");
const paymentsUploadDir = path.join(__dirname, "../../uploads/payments");
const guestIdsUploadDir = path.join(__dirname, "../../uploads/guest-ids");

createDir(productsUploadDir);
createDir(paymentsUploadDir);
createDir(guestIdsUploadDir);

// Configure Storage for Products
const productStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, productsUploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `product-${uniqueSuffix}${ext}`);
  },
});

// Configure Storage for Payments / Receipts
const paymentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, paymentsUploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `receipt-${uniqueSuffix}${ext}`);
  },
});

// Configure Storage for Guest IDs / Passports
const guestIdStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, guestIdsUploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `guest-id-${uniqueSuffix}${ext}`);
  },
});

// File filter for images
const imageFileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp|gif/;
  const extName = allowedTypes.test(
    path.extname(file.originalname).toLowerCase()
  );
  const mimeType = allowedTypes.test(file.mimetype);

  if (extName && mimeType) {
    cb(null, true);
  } else {
    cb(new Error("Only image files (.jpg, .jpeg, .png, .webp, .gif) are allowed!"));
  }
};

const uploadProductImage = multer({
  storage: productStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: imageFileFilter,
});

const uploadPaymentReceipt = multer({
  storage: paymentStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: imageFileFilter,
});

const uploadIdImage = multer({
  storage: guestIdStorage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB (high-res camera captures)
  fileFilter: imageFileFilter,
});

module.exports = {
  uploadProductImage,
  uploadPaymentReceipt,
  uploadIdImage,
};
