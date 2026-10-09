extends SceneTree

const Campaign = preload("res://scripts/campaign.gd")
var checks = 0
var failures = 0

func check(condition: bool, description: String):
	checks += 1
	if not condition:
		failures += 1
		push_error("FAIL: " + description)
	else:
		print("PASS: " + description)

func run_hours(game, hours: int):
	for i in hours:
		game.tick(1)

func ground(game) -> Array:
	return game.state.units.filter(func(u): return u.owner == game.state.player and game.unit_types[u.type].category == "land").map(func(u): return u.id)

func war():
	var game = Campaign.new()
	game.diplomacy("war", "305")
	return game

func _init():
	call_deferred("run")

func run():
	var game = Campaign.new()
	check(game.countries.size() == 170 and game.cities.size() == 479 and game.countries.values().filter(func(c): return c.status == "independent").size() == 69 and game.state.states.size() == 70, "historical map: 170 territories, 479 cities, 69 independent states plus Danzig")
	check(game.valid_save(game.state), "a fresh native campaign has a valid save schema")
	check(not game.enemy("255", "255"), "a country cannot be at war with itself")
	game.train("infantry")
	var frozen = JSON.stringify(game.state)
	game.tick(24)
	check(JSON.stringify(game.state) == frozen, "pause freezes time, resources and recruitment")
	var before = game.total("255", "land")
	game.set_paused(false)
	run_hours(game, 100)
	check(game.state.queue.is_empty() and game.total("255", "land") == before + 1, "recruitment spends time and creates a ground unit")
	game.new_game()
	var stock = game.state.states["255"].stock
	var manpower = game.state.states["255"].manpower
	game.train("tank")
	game.cancel_training(game.state.queue[0].id)
	check(game.state.states["255"].stock == stock - 80 and game.state.states["255"].manpower == manpower, "cancellation returns manpower and 75 percent of equipment")
	game.new_game()
	var industry = game.state.states["255"].industry
	game.research("industry")
	check(not game.research("weapons"), "only one simultaneous research project")
	game.set_paused(false)
	run_hours(game, 240)
	check("industry" in game.state.states["255"].technologies and game.state.states["255"].industry == industry + 8, "research finishes and adds industrial capacity")
	game.new_game()
	var army = ground(game)
	check(not game.order(army, "305-salzburg"), "peace blocks an invasion")
	game.diplomacy("relations", "305")
	game.diplomacy("relations", "305")
	check(game.diplomacy("alliance", "305") and not game.diplomacy("war", "305"), "relations unlock alliances; war on an ally is blocked")
	game = war()
	var munich = game.state.units.filter(func(u): return u.owner == "255" and u.type == "infantry" and u.city == "255-munich")[0]
	check(game.land_route(munich, "305-capital").is_empty() and not game.order([munich.id], "305-capital"), "ground units cannot skip enemy city regions to attack Vienna")
	check(game.order([munich.id], "305-salzburg"), "the adjacent Salzburg front accepts a ground invasion")
	industry = game.state.states["255"].industry
	game.set_paused(false)
	run_hours(game, 48)
	check(game.owner("305-salzburg") == "255" and game.owner("305-capital") == "305" and game.state.territories["305"] == "305", "capturing Salzburg leaves Vienna and the rest of Austria Austrian")
	check(game.state.states["255"].industry == industry + 1 and game.state.units.filter(func(u): return u.owner == "305" and u.city == "305-capital").all(func(u): return u.health == 100), "captured local factories transfer; distant defenders remain unharmed")
	check(not game.enemy("255", "255") and not game.state.battles.any(func(b): return b.attacker == b.defender), "reinforcements reaching an occupied city never attack their own army")
	game.order([munich.id], "255-hamburg")
	run_hours(game, 100)
	check(munich.city == "255-hamburg" and munich.order == null, "armies can move to a friendly city during wartime")
	game = war()
	var aircraft = game.state.units.filter(func(u): return u.owner == "255" and game.unit_types[u.type].category == "air").map(func(u): return u.id)
	game.order(aircraft, "305-salzburg")
	game.set_paused(false)
	run_hours(game, 110)
	check(game.owner("305-salzburg") == "305", "aircraft alone cannot occupy a city")
	game.new_game()
	var unit = game.state.units.filter(func(u): return u.owner == "255" and u.type == "infantry" and u.city == "255-capital")[0]
	check(game.land_route(unit, "255-konigsberg").is_empty() and game.order([unit.id], "255-konigsberg") and unit.order.bySea, "East Prussia requires naval transport rather than crossing neutral Poland")
	game.halt([unit.id])
	game.state.units = game.state.units.filter(func(u): return u.owner != "255" or u.type != "ship")
	check(not game.order([unit.id], "255-konigsberg"), "naval transfer is blocked when the fleet is absent")
	game.new_game("305")
	check(not game.train("ship"), "landlocked Austria cannot build a fleet without a port")
	var port = game.cities.values().filter(func(c): return c.country == "325" and c.coastal)[0].id
	game.state.cityControl[port] = "305"
	check(game.train("ship"), "a captured port lets Austria recruit ships")
	game.set_paused(false)
	run_hours(game, 24)
	var progress = game.state.queue[0].progress
	game.state.cityControl[port] = "325"
	run_hours(game, 24)
	check(game.state.queue[0].progress == progress, "losing the last port pauses ship construction")
	game.state.cityControl[port] = "305"
	game.state.queue[0].progress = game.state.queue[0].duration
	game.tick(1)
	check(game.state.units.any(func(u): return u.owner == "305" and u.type == "ship" and u.city == port), "a completed ship spawns in the controlled port")
	game = war()
	for id in game.by_country["305"]:
		if id != "305-capital":
			game.state.cityControl[id] = "255"
	game.order(ground(game), "305-capital")
	game.set_paused(false)
	for i in 300:
		game.tick(1)
		if game.owner("305-capital") == "255":
			break
	check(game.state.territories["305"] == "255" and "305" in game.state.defeated and not game.state.units.any(func(u): return u.owner == "305"), "losing all cities capitulates the country and removes its army")
	game = war()
	game.order(ground(game), "305-salzburg")
	game.set_paused(false)
	for i in 80:
		game.tick(1)
		if game.owner("305-salzburg") == "255":
			break
	check(game.owner("305-salzburg") == "255", "occupation is established before the counterattack scenario")
	var combined_industry = game.state.states["255"].industry + game.state.states["305"].industry
	game.state.units = game.state.units.filter(func(u): return u.owner != "255" or u.city == "305-salzburg")
	for defender in game.state.units:
		if defender.owner == "305" and game.unit_types[defender.type].category == "land":
			defender.count = 100
			defender.organization = 100
	game.state.player = "305"
	game.order(ground(game), "305-salzburg")
	for i in 100:
		game.tick(1)
		if game.owner("305-salzburg") == "305":
			break
	check(game.owner("305-salzburg") == "305" and game.state.states["255"].industry + game.state.states["305"].industry == combined_industry, "a counterattack recaptures the city without duplicating factories")
	game = war()
	game.state.cityControl["305-salzburg"] = "255"
	game.order(ground(game), "305-linz")
	var path = "user://native-test-save.json"
	check(game.save_game(path) and game.save_game(path), "atomic save succeeds, including replacing an existing file")
	var loaded = Campaign.new()
	check(loaded.load_game(path) and loaded.state.paused and loaded.owner("305-salzburg") == "255" and loaded.owner("305-capital") == "305" and loaded.state.units.any(func(u): return u.order != null and u.order.targetCity == "305-linz"), "save/load preserves partial city occupation, orders and pauses time")
	var corrupt = loaded.state.duplicate(true)
	corrupt.cityControl["305-capital"] = "missing"
	check(not loaded.valid_save(corrupt) and not loaded.valid_save({}) and not loaded.valid_save(null), "invalid and incomplete saves are rejected")
	corrupt = loaded.state.duplicate(true)
	corrupt.events = [{}]
	check(not loaded.valid_save(corrupt), "malformed event records cannot crash a loaded UI")
	corrupt = loaded.state.duplicate(true)
	corrupt.units[0].order = {"targetCity": "305-salzburg", "target": "305", "route": ["305-salzburg"], "duration": 20, "progress": 0, "from": ["bad", 0]}
	check(not loaded.valid_save(corrupt), "invalid route coordinates are rejected before loading")
	var browser_save = loaded.state.duplicate(true)
	browser_save.version = 2
	var file = FileAccess.open(path, FileAccess.WRITE)
	file.store_string(JSON.stringify(browser_save))
	file.close()
	check(loaded.load_game(path) and loaded.state.version == 3, "browser v2 JSON saves can be imported into native Godot campaigns")
	DirAccess.remove_absolute(path)
	game = war()
	game.set_paused(false)
	run_hours(game, 73)
	check(game.state.units.any(func(u): return u.owner == "305" and u.order != null), "enemy AI issues its own city counterattack after 72 hours")
	print("NATIVE TESTS: %s checks, %s failures" % [checks, failures])
	quit(1 if failures > 0 else 0)
