-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(30) NOT NULL,
    `companyId` VARCHAR(30) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `email` VARCHAR(254) NOT NULL,
    `passwordHash` VARCHAR(255) NOT NULL,
    `role` ENUM('ADMIN', 'EMPLOYEE') NOT NULL DEFAULT 'EMPLOYEE',
    `sessionVersion` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `User_email_key`(`email`),
    INDEX `User_companyId_name_idx`(`companyId`, `name`),
    UNIQUE INDEX `User_id_companyId_key`(`id`, `companyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Inventory` (
    `id` VARCHAR(30) NOT NULL,
    `companyId` VARCHAR(30) NOT NULL,
    `name` VARCHAR(120) NOT NULL,

    UNIQUE INDEX `Inventory_companyId_key`(`companyId`),
    UNIQUE INDEX `Inventory_id_companyId_key`(`id`, `companyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Category` (
    `id` VARCHAR(30) NOT NULL,
    `companyId` VARCHAR(30) NOT NULL,
    `name` VARCHAR(80) NOT NULL,

    UNIQUE INDEX `Category_id_companyId_key`(`id`, `companyId`),
    UNIQUE INDEX `Category_companyId_name_key`(`companyId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FoodItem` (
    `id` VARCHAR(30) NOT NULL,
    `companyId` VARCHAR(30) NOT NULL,
    `inventoryId` VARCHAR(30) NOT NULL,
    `categoryId` VARCHAR(30) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `quantity` DECIMAL(12, 3) NOT NULL,
    `unit` VARCHAR(20) NOT NULL,
    `receivedDate` DATE NOT NULL,
    `expiresDate` DATE NOT NULL,
    `minimumStock` DECIMAL(12, 3) NOT NULL DEFAULT 0,

    INDEX `FoodItem_companyId_name_idx`(`companyId`, `name`),
    INDEX `FoodItem_companyId_expiresDate_idx`(`companyId`, `expiresDate`),
    INDEX `FoodItem_categoryId_companyId_idx`(`categoryId`, `companyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Recipe` (
    `id` VARCHAR(30) NOT NULL,
    `companyId` VARCHAR(30) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `description` VARCHAR(500) NOT NULL,
    `preparation` TEXT NOT NULL,

    INDEX `Recipe_companyId_name_idx`(`companyId`, `name`),
    UNIQUE INDEX `Recipe_id_companyId_key`(`id`, `companyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RecipeIngredient` (
    `id` VARCHAR(30) NOT NULL,
    `companyId` VARCHAR(30) NOT NULL,
    `recipeId` VARCHAR(30) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `quantity` DECIMAL(12, 3) NOT NULL,
    `unit` VARCHAR(20) NOT NULL,

    INDEX `RecipeIngredient_recipeId_companyId_idx`(`recipeId`, `companyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ChatRoom` (
    `id` VARCHAR(30) NOT NULL,
    `companyId` VARCHAR(30) NOT NULL,
    `name` VARCHAR(80) NOT NULL,

    UNIQUE INDEX `ChatRoom_id_companyId_key`(`id`, `companyId`),
    UNIQUE INDEX `ChatRoom_companyId_name_key`(`companyId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ChatMessage` (
    `id` VARCHAR(30) NOT NULL,
    `companyId` VARCHAR(30) NOT NULL,
    `roomId` VARCHAR(30) NOT NULL,
    `userId` VARCHAR(30) NOT NULL,
    `content` VARCHAR(2000) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ChatMessage_roomId_companyId_createdAt_id_idx`(`roomId`, `companyId`, `createdAt`, `id`),
    INDEX `ChatMessage_userId_companyId_idx`(`userId`, `companyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PasswordResetToken` (
    `id` VARCHAR(30) NOT NULL,
    `userId` VARCHAR(30) NOT NULL,
    `tokenHash` CHAR(64) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `consumedAt` DATETIME(3) NULL,

    UNIQUE INDEX `PasswordResetToken_userId_key`(`userId`),
    UNIQUE INDEX `PasswordResetToken_tokenHash_key`(`tokenHash`),
    INDEX `PasswordResetToken_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Session` (
    `id` VARCHAR(128) NOT NULL,
    `userId` VARCHAR(30) NULL,
    `data` JSON NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,

    INDEX `Session_expiresAt_idx`(`expiresAt`),
    INDEX `Session_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Inventory` ADD CONSTRAINT `Inventory_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Category` ADD CONSTRAINT `Category_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FoodItem` ADD CONSTRAINT `FoodItem_inventoryId_companyId_fkey` FOREIGN KEY (`inventoryId`, `companyId`) REFERENCES `Inventory`(`id`, `companyId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FoodItem` ADD CONSTRAINT `FoodItem_categoryId_companyId_fkey` FOREIGN KEY (`categoryId`, `companyId`) REFERENCES `Category`(`id`, `companyId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Recipe` ADD CONSTRAINT `Recipe_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RecipeIngredient` ADD CONSTRAINT `RecipeIngredient_recipeId_companyId_fkey` FOREIGN KEY (`recipeId`, `companyId`) REFERENCES `Recipe`(`id`, `companyId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatRoom` ADD CONSTRAINT `ChatRoom_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatMessage` ADD CONSTRAINT `ChatMessage_roomId_companyId_fkey` FOREIGN KEY (`roomId`, `companyId`) REFERENCES `ChatRoom`(`id`, `companyId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatMessage` ADD CONSTRAINT `ChatMessage_userId_companyId_fkey` FOREIGN KEY (`userId`, `companyId`) REFERENCES `User`(`id`, `companyId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PasswordResetToken` ADD CONSTRAINT `PasswordResetToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Session` ADD CONSTRAINT `Session_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Business invariants complement application validation; legacy data is not imported.
ALTER TABLE `FoodItem` ADD CONSTRAINT `FoodItem_nonnegative_stock` CHECK (`quantity` >= 0 AND `minimumStock` >= 0);
ALTER TABLE `FoodItem` ADD CONSTRAINT `FoodItem_valid_dates` CHECK (`expiresDate` >= `receivedDate`);
ALTER TABLE `RecipeIngredient` ADD CONSTRAINT `RecipeIngredient_positive_quantity` CHECK (`quantity` > 0);
