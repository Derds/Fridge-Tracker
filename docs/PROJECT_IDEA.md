this is a project in order to help with meal planning, ingredient tracking, inventory and recipes.

i want to be able to simplify the process of meal planning and tracking.

initial plans
- lightweight webapp which allows user to see what food they have, when it needs used by
- react/ typescript (with state management?)

features
- food database -> for each ingredient added we would need to know how long its average shelf life is (even a default generic tier of very perishable (1-3days), perishable(3-5 days), stable, shelf stable -> all though these tiers should be researched and updateds), should also be able to store some basic nutritional information (even just high level eg. high in magnesium, low in fat, nominal protein) - this isnt needed for seasoning category , it would also have fields for optimal storage conditions, or other notes
- inventory database -> for ingredients in the food database i should have another table of if that ingredient is in my home and some date tracking so i know how many days it has until expiration. i should also have an idea of how many servings a specific food has in it, so if i buy a pack with 2 chicken breasts i can record that or if it has 3 chicken breasts i can record that
- inventory depletion -> i should be able to quickly select ingredients from a list of inventory and mark them off as used. this will reduce the servings left so chicken servings might go from 2 to 1 or 1 to 0. if it goes to zero then its removed from inventory and back to potential shopping list
- clear expired foods -> i should be able to see a list of all expired foods and clear all or all except specific list from my inventory list.
- new ingredient -> if a new brand of item or new ingredient is at the shop i should be able to add a new ingredient from a template (fruit, veg, meat/protein, shelf-staple, seasoning, other etc), it should be ok if i only have partial information on it at the time i can come back and add say nutritional information optionally later
- shopping list feature -> adds depleted ingredients to a potential shopping list, and then allows user to pick from that potential for a real list (i.e. if i run out of grapes i might decide to buy them again next time im at the shop but i might decide i dont want them this time, i should be able to pick my shopping list from a list of depleted/common ingredients)
- potential and actual shopping list.
- easy restock -> it should be very easy to come home from a shop and update what food is in stock and when it needs to be eaten by
- common meals - i should be able to track some common meals and recipes / ingredients and swipe through them as a gallery of items so i can decide what i want to eat
- meal planning - i should be able to plan a week of meals in a few ways, ideally i could select ingredients i want to use and drag them into a day

future ideas
- nutritional information of meals -> when
- recipe detection from websites
- recipe suggestion especially seasonal vegetable suggestions -> prioritising in season food
- ingredient web search and storage information
- shopping list planning -> help the user create a list of food and understand if they are over/undershopping for the week (maybe based on asking how many meals the user will be at home/out for and help the user to understand if the meals they have time for are super quick grab and go meals or more involved cooking.)
- price estimations for a shopping trip my web searching specific supermarkets.
- images of meals  - i should be able to upload an image of my meal and save a compressed/low quality dithered image of it so i can see a gallery of what i might want to eat


Further ideas
- visuals with a drag and drop meal planner to see if your day is too high in fat / low in veg
- veggie and vegan swap suggestions
- graphs to see how well you are eating (big picture)
- cycle synced suggestions -> future integration
- hooks to tidy up dependancies and update security issues
- connect key details to sync thing?
- meal plan costing -> scrape ingredient prices from supermarket websites -> add this to own feature folder
- substitutions in meal plan eg doesnt matter which rice or greens, just want one of them
- optional ingredients eg toppings?
- actual meals vs meal plan -> what did i actually eat -> this data shouldn't be saved to github nd should be exportable as json or csv
