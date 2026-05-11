import mongoose from "mongoose";

export async function connectDB() {
  const conn = await mongoose.connect(process.env.MONGODB_URI, {
    tls: true,
    tlsAllowInvalidCertificates: true,
    tlsAllowInvalidHostnames: true,
    serverSelectionTimeoutMS: 15000,
  });
  console.log(`MongoDB connected: ${conn.connection.host}`);
}
