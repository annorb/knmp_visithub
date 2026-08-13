CREATE TABLE `attractions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`slug` varchar(200) NOT NULL,
	`description` text NOT NULL,
	`imageUrl` text,
	`openingHours` varchar(200),
	`location` varchar(200),
	`averageVisitDurationMin` int DEFAULT 30,
	`sortIndex` int DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `attractions_id` PRIMARY KEY(`id`),
	CONSTRAINT `attractions_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `booking_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bookingId` int NOT NULL,
	`categoryId` int NOT NULL,
	`categoryName` varchar(100) NOT NULL,
	`unitPricePesewas` int NOT NULL,
	`quantity` int NOT NULL,
	`subtotalPesewas` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `booking_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bookings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reference` varchar(32) NOT NULL,
	`userId` int NOT NULL,
	`visitDate` timestamp NOT NULL,
	`visitorName` varchar(200),
	`contactEmail` varchar(320),
	`contactPhone` varchar(64),
	`totalPesewas` int NOT NULL,
	`status` enum('pending','confirmed','cancelled') NOT NULL DEFAULT 'pending',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bookings_id` PRIMARY KEY(`id`),
	CONSTRAINT `bookings_reference_unique` UNIQUE(`reference`)
);
--> statement-breakpoint
CREATE TABLE `itinerary_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`bookingId` int,
	`visitDate` timestamp NOT NULL,
	`title` varchar(200) NOT NULL,
	`description` text,
	`timeSlot` varchar(50),
	`attractionId` int,
	`attractionName` varchar(200),
	`sortIndex` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `itinerary_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `visitor_categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`slug` varchar(100) NOT NULL,
	`pricePesewas` int NOT NULL,
	`description` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`sortIndex` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `visitor_categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `visitor_categories_slug_unique` UNIQUE(`slug`)
);
