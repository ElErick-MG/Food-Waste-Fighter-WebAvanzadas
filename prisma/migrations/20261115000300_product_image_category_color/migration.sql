-- Front-end redesign, stage 2: additive and nullable columns only.
-- Existing rows keep NULL; no data is rewritten or removed.

-- AlterTable
ALTER TABLE `Category` ADD COLUMN `color` VARCHAR(7) NULL;

-- AlterTable
ALTER TABLE `FoodItem` ADD COLUMN `imageUrl` VARCHAR(500) NULL;
