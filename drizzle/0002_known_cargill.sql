CREATE TABLE `booking_slots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bookingId` int NOT NULL,
	`slotId` int NOT NULL,
	`attractionId` int NOT NULL,
	`attractionName` varchar(200),
	`visitDate` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `booking_slots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tour_slots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`attractionId` int NOT NULL,
	`startTime` varchar(5) NOT NULL,
	`endTime` varchar(5) NOT NULL,
	`label` varchar(100),
	`maxCapacity` int DEFAULT 25,
	`bookedCount` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tour_slots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `bookings` ADD `visitEndDate` timestamp;