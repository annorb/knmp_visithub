CREATE TABLE `event_registrations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reference` varchar(20) NOT NULL,
	`eventId` int NOT NULL,
	`userId` int NOT NULL,
	`attendeeName` varchar(200) NOT NULL,
	`contactEmail` varchar(200),
	`numberOfParticipants` int NOT NULL DEFAULT 1,
	`isCancelled` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `event_registrations_id` PRIMARY KEY(`id`),
	CONSTRAINT `event_registrations_reference_unique` UNIQUE(`reference`)
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(200) NOT NULL,
	`slug` varchar(200) NOT NULL,
	`description` text NOT NULL,
	`eventType` varchar(20) NOT NULL DEFAULT 'program',
	`attractionId` int,
	`eventDate` date NOT NULL,
	`startTime` varchar(5),
	`endTime` varchar(5),
	`meetingPoint` varchar(200),
	`guideName` varchar(100),
	`imageUrl` text,
	`capacity` int NOT NULL DEFAULT 0,
	`feePesewas` int NOT NULL DEFAULT 0,
	`registrationDeadline` date,
	`isPublished` boolean NOT NULL DEFAULT false,
	`sortIndex` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `events_id` PRIMARY KEY(`id`),
	CONSTRAINT `events_slug_unique` UNIQUE(`slug`)
);
