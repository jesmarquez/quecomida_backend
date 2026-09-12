const { PrismaClient } = require("@prisma/client");

// Reuse a single PrismaClient instance across the app (avoids exhausting
// database connections when this file is imported in multiple places).
const prisma = new PrismaClient();

module.exports = prisma;
