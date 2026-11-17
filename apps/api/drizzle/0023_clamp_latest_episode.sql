UPDATE `anime` SET `latest_episode` = `episodes` WHERE `episodes` IS NOT NULL AND `episodes` > 0 AND `latest_episode` > `episodes`;
