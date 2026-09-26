-- CreateEnum
CREATE TYPE "DietaryInfo" AS ENUM ('GLUTEN_FREE', 'VEGAN', 'CARNIVORE', 'ITALIAN');

-- AlterTable
ALTER TABLE "MealPost" ADD COLUMN     "customTags" TEXT[],
ADD COLUMN     "dietaryTags" "DietaryInfo"[];
