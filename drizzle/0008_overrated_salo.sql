ALTER TABLE `visitor_categories` ADD `isGroup` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `visitor_categories` ADD `groupMinQty` int DEFAULT 15;--> statement-breakpoint
ALTER TABLE `visitor_categories` ADD `groupDiscountPercent` int DEFAULT 15;