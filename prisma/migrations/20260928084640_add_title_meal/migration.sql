/*
  Warnings:

  - Added the required column `title` to the `MealPost` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "MealPost" ADD COLUMN     "title" TEXT NOT NULL;
