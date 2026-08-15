CREATE TABLE `itinerary_shares` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`shareCode` varchar(32) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `itinerary_shares_id` PRIMARY KEY(`id`),
	CONSTRAINT `itinerary_shares_shareCode_unique` UNIQUE(`shareCode`)
);
