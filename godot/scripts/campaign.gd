extends RefCounted
## Standalone deterministic simulation. It does not depend on scenes or browsers.

signal changed
signal notified(message: String, is_error: bool)

const SAVE_PATH = "user://campaign.json"
var countries: Dictionary
var cities: Dictionary
var unit_types: Dictionary
var technologies: Dictionary
var majors: Array
var initial: Dictionary
var state: Dictionary
var by_country: Dictionary = {}

func _init():
	var data = JSON.parse_string(FileAccess.get_file_as_string("res://data/game.json"))
	countries = data.countries
	unit_types = data.unit_types
	technologies = data.technologies
	majors = data.majors
	initial = data.initial
	cities = JSON.parse_string(FileAccess.get_file_as_string("res://data/cities.json"))
	for city in cities.values():
		if not by_country.has(city.country):
			by_country[city.country] = []
		by_country[city.country].append(city.id)
	new_game()

func new_game(player: String = "255"):
	state = initial.duplicate(true)
	state.version = 3
	state.player = player
	state.events = []
	log_event("1 января 1936 года. %s: командование ждёт приказов." % countries[player].name)
	changed.emit()

func owner(city_id: String) -> String:
	return state.cityControl.get(city_id, "")

func enemy(a: String, b: String) -> bool:
	if a == b:
		return false
	for war in state.wars:
		if a in war and b in war:
			return true
	return false

func friendly(a: String, b: String) -> bool:
	return a == b or (a == state.player and b in state.allies)

func log_event(message: String, kind: String = "info"):
	state.events.push_front({"id": "event-%s" % state.nextId, "hours": state.hours, "text": message, "type": kind})
	state.nextId += 1
	if state.events.size() > 60:
		state.events.pop_back()

func feedback(message: String, error: bool = false) -> bool:
	notified.emit(message, error)
	return not error

func set_paused(paused: bool):
	if state.player in state.defeated and not paused:
		feedback("Государство капитулировало. Начните новую кампанию.", true)
		return
	state.paused = paused
	changed.emit()

func distance(a: Array, b: Array) -> float:
	var lat = deg_to_rad(b[1] - a[1])
	var lon = deg_to_rad(b[0] - a[0])
	var h = sin(lat / 2.0) ** 2 + cos(deg_to_rad(a[1])) * cos(deg_to_rad(b[1])) * sin(lon / 2.0) ** 2
	return 12742.0 * asin(sqrt(clampf(h, 0.0, 1.0)))

func unit_by_id(id: String) -> Dictionary:
	for unit in state.units:
		if unit.id == id:
			return unit
	return {}

func engaged(unit: Dictionary) -> bool:
	for battle in state.battles:
		if unit.id in battle.units or (battle.targetCity == unit.city and battle.defender == unit.owner):
			return true
	return false

func total(owner_id: String, category: String = "") -> int:
	var result = 0
	for unit in state.units:
		if unit.owner == owner_id and (category.is_empty() or unit_types[unit.type].category == category):
			result += int(unit.count)
	return result

func power(unit: Dictionary) -> float:
	var stats = state.states[unit.owner]
	var kind = unit_types[unit.type]
	var tech = 1.0
	if kind.category == "land" and "weapons" in stats.technologies:
		tech = 1.2
	elif kind.category != "land" and "aviation" in stats.technologies:
		tech = 1.3
	var fuel = 0.45 if kind.fuel > 0 and stats.fuel <= 0 else 1.0
	return unit.count * kind.power * unit.health / 100.0 * maxf(0.3, unit.organization / 100.0) * tech * fuel

func land_route(unit: Dictionary, target: String) -> Array:
	if unit.city == target:
		return [target]
	var costs = {unit.city: 0.0}
	var previous = {}
	var open = [unit.city]
	while not open.is_empty():
		var current = open[0]
		for id in open:
			if costs[id] < costs[current]:
				current = id
		open.erase(current)
		if current == target:
			var route = [current]
			while previous.has(route[0]):
				route.push_front(previous[route[0]])
			return route
		for adjacent in cities[current].neighbors:
			if adjacent != target and not friendly(unit.owner, owner(adjacent)):
				continue
			var cost = costs[current] + distance(cities[current].position, cities[adjacent].position)
			if cost < costs.get(adjacent, INF):
				costs[adjacent] = cost
				previous[adjacent] = current
				if adjacent not in open:
					open.append(adjacent)
	return []

func order(ids: Array, target: String) -> bool:
	if not cities.has(target):
		return feedback("Выберите город назначения.", true)
	var controller = owner(target)
	if not friendly(state.player, controller) and not enemy(state.player, controller):
		return feedback("Сначала объявите войну или заключите союз.", true)
	var ordered = 0
	var problem = "Нет доступного фронта. Сначала захватите соседние области."
	for id in ids:
		var unit = unit_by_id(id)
		if unit.is_empty() or unit.owner != state.player:
			continue
		if engaged(unit):
			problem = "Подразделение уже участвует в сражении."
			continue
		if unit.city == target and not enemy(unit.owner, controller):
			continue
		var kind = unit_types[unit.type].category
		var route = [unit.city, target]
		var by_sea = false
		if kind == "land":
			route = land_route(unit, target)
			if route.is_empty() and cities[target].coastal and total(unit.owner, "naval") > 0:
				var ports = []
				for city in cities.values():
					if city.coastal and owner(city.id) == unit.owner and distance(city.position, cities[target].position) < 6500:
						ports.append(city.id)
				ports.sort_custom(func(a, b): return distance(unit.position, cities[a].position) < distance(unit.position, cities[b].position))
				for port in ports:
					var approach = land_route(unit, port)
					if not approach.is_empty():
						route = approach + [target]
						by_sea = true
						break
			if route.is_empty():
				continue
		if kind == "air" and distance(unit.position, cities[target].position) > 2500:
			problem = "Радиус авиации — 2 500 км."
			continue
		if kind == "naval" and not cities[target].coastal:
			problem = "Флот действует только в портовых городах."
			continue
		var length = 0.0
		var point = unit.position
		for next in route.slice(1):
			length += distance(point, cities[next].position)
			point = cities[next].position
		var duration = maxf(6.0, length / 18.0)
		if kind == "air":
			duration = 8.0
		elif kind == "naval":
			duration = 30.0
		unit.order = {"target": cities[target].country, "targetCity": target, "route": route, "bySea": by_sea, "progress": 0.0, "duration": duration, "from": unit.position.duplicate(), "mission": kind != "land"}
		ordered += 1
	if ordered == 0:
		return feedback(problem, true)
	log_event("%s: приказ передан %s подразделениям." % [cities[target].name, ordered], "war" if enemy(state.player, controller) else "info")
	changed.emit()
	return feedback("Цель: %s. Подразделений: %s." % [cities[target].name, ordered])

func halt(ids: Array):
	for id in ids:
		var unit = unit_by_id(id)
		if not unit.is_empty() and unit.owner == state.player and not engaged(unit) and unit.order != null:
			unit.position = unit.order.from.duplicate()
			unit.order = null
	changed.emit()

func controlled_cities(owner_id: String, ports_only: bool = false) -> Array:
	var result = []
	for city in cities.values():
		if owner(city.id) == owner_id and (not ports_only or city.coastal):
			result.append(city.id)
	return result

func train(kind: String) -> bool:
	var stats = state.states[state.player]
	if not unit_types.has(kind):
		return false
	var data = unit_types[kind]
	if data.category == "naval" and controlled_cities(state.player, true).is_empty():
		return feedback("Для строительства кораблей нужен подконтрольный порт.", true)
	if stats.stock < data.cost or stats.manpower < data.men:
		return feedback("Недостаточно снаряжения или людских резервов.", true)
	var count = 0
	for item in state.queue:
		if item.owner == state.player:
			count += 1
	if count >= 6:
		return feedback("Одновременно можно готовить 6 подразделений.", true)
	stats.stock -= data.cost
	stats.manpower -= data.men
	state.queue.append({"id": "queue-%s" % state.nextId, "owner": state.player, "type": kind, "progress": 0.0, "duration": data.days * 24.0})
	state.nextId += 1
	log_event("Начата подготовка: %s." % data.name, "production")
	changed.emit()
	return feedback("Подразделение добавлено в очередь.")

func cancel_training(id: String):
	for item in state.queue:
		if item.id == id and item.owner == state.player:
			var stats = state.states[state.player]
			stats.stock += unit_types[item.type].cost * 0.75
			stats.manpower += unit_types[item.type].men
			state.queue.erase(item)
			changed.emit()
			return

func research(tech: String) -> bool:
	var stats = state.states[state.player]
	if tech in stats.technologies:
		return feedback("Технология уже изучена.", true)
	for item in state.research:
		if item.owner == state.player:
			return feedback("Дождитесь окончания текущего исследования.", true)
	if stats.stock < technologies[tech].cost:
		return feedback("Недостаточно снаряжения.", true)
	stats.stock -= technologies[tech].cost
	state.research.append({"owner": state.player, "tech": tech, "progress": 0.0, "duration": technologies[tech].days * 24.0})
	log_event("Начато исследование: %s." % technologies[tech].name, "production")
	changed.emit()
	return feedback("Исследование начато.")

func diplomacy(kind: String, target: String) -> bool:
	if target == state.player or not state.states.has(target) or target in state.defeated:
		return feedback("Выберите независимое иностранное государство.", true)
	var stats = state.states[state.player]
	var other = state.states[target]
	if kind == "war":
		if enemy(state.player, target) or target in state.allies:
			return feedback("Война недоступна: государство уже воюет с вами или является союзником.", true)
		if stats.political < 50:
			return feedback("Нужно 50 политического влияния.", true)
		stats.political -= 50
		stats.stability = maxf(20, stats.stability - 3)
		state.wars.append([state.player, target])
		log_event("%s объявляет войну: %s." % [countries[state.player].name, countries[target].name], "war")
	elif enemy(state.player, target):
		return feedback("Дипломатия недоступна во время войны.", true)
	elif kind == "relations":
		if stats.political < 20:
			return feedback("Нужно 20 политического влияния.", true)
		stats.political -= 20
		other.relation = minf(100, other.relation + 30)
		log_event("Отношения с %s улучшены." % countries[target].name)
	elif kind == "alliance":
		if other.relation < 60:
			return feedback("Для союза нужны отношения +60.", true)
		if target not in state.allies:
			state.allies.append(target)
			log_event("Заключён союз: %s." % countries[target].name, "success")
	changed.emit()
	return feedback("Дипломатическое действие выполнено.")

func station(unit: Dictionary, city_id: String):
	unit.city = city_id
	unit.location = cities[city_id].country
	unit.position = cities[city_id].position.duplicate()
	unit.order = null

func retreat(unit: Dictionary, exclude: String):
	var available = controlled_cities(unit.owner)
	available.erase(exclude)
	if available.is_empty():
		unit.health = 0
		return
	available.sort_custom(func(a, b): return distance(unit.position, cities[a].position) < distance(unit.position, cities[b].position))
	station(unit, available[0])
	unit.health = maxf(10, unit.health)
	unit.organization = maxf(20, unit.organization)

func arrive(unit: Dictionary):
	var target = unit.order.targetCity
	unit.order = null
	if not enemy(unit.owner, owner(target)):
		if friendly(unit.owner, owner(target)):
			station(unit, target)
		else:
			station(unit, unit.city)
		return
	var battle = {}
	for candidate in state.battles:
		if candidate.targetCity == target and candidate.attacker == unit.owner:
			battle = candidate
			break
	if battle.is_empty():
		battle = {"id": "battle-%s" % state.nextId, "target": cities[target].country, "targetCity": target, "attacker": unit.owner, "defender": owner(target), "units": [], "progress": 0.0, "elapsed": 0.0}
		state.nextId += 1
		state.battles.append(battle)
		log_event("Сражение за %s началось." % cities[target].name, "war")
	if unit.id not in battle.units:
		battle.units.append(unit.id)

func move(unit: Dictionary, hours: float):
	var command = unit.order
	if unit_types[unit.type].category == "land":
		for intermediate in command.route.slice(1, -1):
			if not friendly(unit.owner, owner(intermediate)):
				station(unit, unit.city)
				log_event("Маршрут перекрыт. Приказ остановлен.", "war")
				return
	command.progress += hours
	var points = [command.from]
	for id in command.route.slice(1):
		points.append(cities[id].position)
	if points.size() == 1:
		points.append(cities[command.targetCity].position)
	var lengths = []
	var length = 0.0
	for i in range(points.size() - 1):
		var segment = distance(points[i], points[i + 1])
		lengths.append(segment)
		length += segment
	var remaining = minf(1.0, command.progress / command.duration) * length
	var index = 0
	while index < lengths.size() - 1 and remaining > lengths[index]:
		remaining -= lengths[index]
		index += 1
	var fraction = minf(1.0, remaining / lengths[index]) if lengths[index] > 0 else 1.0
	unit.position = [lerpf(points[index][0], points[index + 1][0], fraction), lerpf(points[index][1], points[index + 1][1], fraction)]
	if command.progress >= command.duration:
		arrive(unit)

func capture(battle: Dictionary):
	var city = cities[battle.targetCity]
	var previous = owner(city.id)
	if previous == battle.attacker:
		return
	state.cityControl[city.id] = battle.attacker
	var factories = minf(city.industry, state.states[previous].industry)
	state.states[previous].industry -= factories
	state.states[battle.attacker].industry += factories
	var controller = owner(by_country[city.country][0])
	var full_control = true
	for id in by_country[city.country]:
		if owner(id) != controller:
			full_control = false
	state.territories[city.country] = controller if full_control else countries[city.country].owner
	log_event("Город %s захвачен. Контроль: %s." % [city.name, countries[battle.attacker].name], "success")

func tick(hours: float = 1.0):
	if state.paused or hours <= 0:
		return
	hours = minf(hours, 24)
	var previous_hours = state.hours
	state.hours += hours
	for id in state.states:
		var stats = state.states[id]
		stats.stock += stats.industry * 0.55 * hours / 24.0
		stats.manpower += stats.industry * 20 * hours / 24.0
		stats.political += 2.5 * hours / 24.0
		var usage = 0.0
		for unit in state.units:
			if unit.owner == id and (unit.order != null or engaged(unit)):
				usage += unit_types[unit.type].fuel * unit.count
		stats.fuel = clampf(stats.fuel + (stats.industry * 2 - usage * 8) * hours / 24.0, 0, 30000)
	for unit in state.units:
		if unit.order != null:
			move(unit, hours)
		elif not engaged(unit):
			unit.organization = minf(100, unit.organization + hours * 0.3)
			unit.health = minf(100, unit.health + hours * 0.04)
	for item in state.queue.duplicate():
		var available = controlled_cities(item.owner, item.type == "ship")
		if available.is_empty():
			continue
		item.progress += hours * minf(1.8, 0.6 + state.states[item.owner].industry / 80.0)
		if item.progress >= item.duration:
			var city = available[0]
			for id in available:
				if cities[id].capital and cities[id].country == item.owner:
					city = id
			state.units.append({"id": "unit-%s" % state.nextId, "owner": item.owner, "type": item.type, "count": 1, "health": 100.0, "organization": 100.0, "location": cities[city].country, "city": city, "position": cities[city].position.duplicate(), "order": null})
			state.nextId += 1
			log_event("%s: новое подразделение готово." % unit_types[item.type].name, "success")
			state.queue.erase(item)
	for item in state.research.duplicate():
		item.progress += hours
		if item.progress >= item.duration:
			state.states[item.owner].technologies.append(item.tech)
			if item.tech == "industry":
				state.states[item.owner].industry += 8
			log_event("Исследование завершено: %s." % technologies[item.tech].name, "success")
			state.research.erase(item)
	for battle in state.battles.duplicate():
		var attackers = state.units.filter(func(u): return u.id in battle.units)
		var defenders = state.units.filter(func(u): return u.owner == battle.defender and u.city == battle.targetCity and u.order == null and u.id not in battle.units)
		var attack = 0.0
		var defense = float(cities[battle.targetCity].garrison)
		var has_ground = false
		for unit in attackers:
			attack += power(unit)
			has_ground = has_ground or unit_types[unit.type].category == "land"
		for unit in defenders:
			defense += power(unit)
		battle.elapsed += hours
		battle.progress = clampf(battle.progress + hours * (attack / maxf(20, defense) - 0.4) * 1.2, -100, 100)
		for unit in attackers:
			unit.organization = maxf(0, unit.organization - hours * 0.5)
			unit.health = maxf(0, unit.health - hours * defense / maxf(20, attack) * 0.14)
		for unit in defenders:
			unit.organization = maxf(0, unit.organization - hours * 0.45)
			unit.health = maxf(0, unit.health - hours * attack / maxf(20, defense) * 0.14)
		if battle.progress >= 100 and has_ground:
			capture(battle)
			for unit in attackers:
				station(unit, battle.targetCity if unit_types[unit.type].category == "land" else unit.city)
				unit.organization = maxf(30, unit.organization)
			for unit in defenders:
				retreat(unit, battle.targetCity)
			state.battles.erase(battle)
		elif battle.progress <= -100 or attackers.is_empty() or attackers.all(func(u): return u.health < 15 or u.organization < 10) or (battle.elapsed >= 96 and not has_ground):
			for unit in attackers:
				if owner(unit.city) != unit.owner:
					retreat(unit, battle.targetCity)
				else:
					station(unit, unit.city)
				unit.organization = 30
			log_event("%s: наступление остановлено." % cities[battle.targetCity].name if has_ground else "Миссия завершена. Для захвата нужны сухопутные войска.", "war")
			state.battles.erase(battle)
	state.units = state.units.filter(func(u): return u.health > 0)
	for id in state.states:
		if id in state.defeated or id in state.cityControl.values():
			continue
		state.defeated.append(id)
		state.units = state.units.filter(func(u): return u.owner != id)
		state.queue = state.queue.filter(func(q): return q.owner != id)
		state.research = state.research.filter(func(r): return r.owner != id)
		state.wars = state.wars.filter(func(w): return id not in w)
		log_event("%s капитулирует: все города потеряны." % countries[id].name, "war")
		if id == state.player:
			state.paused = true
	if floor(state.hours / 72) > floor(previous_hours / 72):
		counterattack()
	changed.emit()

func counterattack():
	for war in state.wars:
		var opponent = war[1] if war[0] == state.player else war[0]
		var fronts = []
		for city in cities.values():
			if owner(city.id) == state.player and city.neighbors.any(func(id): return owner(id) == opponent):
				fronts.append(city.id)
		fronts.sort_custom(func(a, b): return int(countries[cities[a].country].owner == opponent) > int(countries[cities[b].country].owner == opponent))
		var count = 0
		for unit in state.units:
			if unit.owner != opponent or unit.order != null or engaged(unit) or unit_types[unit.type].category != "land" or unit.organization <= 60:
				continue
			for target in fronts:
				var route = land_route(unit, target)
				if not route.is_empty():
					var length = 0.0
					for i in range(route.size() - 1):
						length += distance(cities[route[i]].position, cities[route[i + 1]].position)
					unit.order = {"target": cities[target].country, "targetCity": target, "route": route, "bySea": false, "progress": 0.0, "duration": maxf(12.0, length / 18.0), "from": unit.position.duplicate(), "mission": false}
					count += 1
					break
			if count >= 2:
				break
		if count > 0:
			log_event("%s: обнаружена контратака." % countries[opponent].name, "war")

func valid_save(value: Variant) -> bool:
	if not value is Dictionary:
		return false
	if not numeric(value.get("version")) or int(value.version) not in [2, 3] or value.version != int(value.version):
		return false
	for key in ["states", "cityControl", "territories"]:
		if not value.get(key) is Dictionary:
			return false
	for key in ["units", "battles", "queue", "research", "events", "wars", "allies", "defeated"]:
		if not value.get(key) is Array:
			return false
	if not value.get("player") is String or not value.states.has(value.player) or not countries.has(value.player):
		return false
	if not value.get("paused") is bool or not value.get("hours") is float and not value.get("hours") is int:
		return false
	if not numeric(value.get("speed")) or int(value.speed) not in [1, 2, 3, 4, 5] or value.speed != int(value.speed):
		return false
	if value.hours < 0 or not is_finite(value.hours) or not numeric(value.get("nextId")) or value.nextId <= 0:
		return false
	if value.cityControl.size() != cities.size():
		return false
	for id in cities:
		if not value.states.has(value.cityControl.get(id, "")):
			return false
	for id in value.states:
		if not countries.has(id) or not value.states[id] is Dictionary:
			return false
		for key in ["manpower", "industry", "fuel", "political", "stock", "stability", "relation"]:
			if not value.states[id].get(key) is float and not value.states[id].get(key) is int:
				return false
			if not is_finite(value.states[id][key]):
				return false
		if not value.states[id].get("technologies") is Array:
			return false
		if not value.states[id].technologies.all(func(id): return technologies.has(id)):
			return false
	if not initial.states.keys().all(func(id): return value.states.has(id)):
		return false
	if value.territories.size() != countries.size():
		return false
	for id in countries:
		if not value.states.has(value.territories.get(id, "")):
			return false
	if not value.allies.all(func(id): return value.states.has(id)) or not value.defeated.all(func(id): return value.states.has(id)):
		return false
	for event in value.events:
		if not event is Dictionary or not event.get("text") is String or not numeric(event.get("hours")):
			return false
	var ids = []
	for unit in value.units:
		if not unit is Dictionary or not cities.has(unit.get("city", "")) or not unit_types.has(unit.get("type", "")) or not value.states.has(unit.get("owner", "")):
			return false
		if not unit.get("id") is String or unit.id in ids or unit.get("location") != cities[unit.city].country:
			return false
		ids.append(unit.id)
		if not unit.get("position") is Array or unit.position.size() != 2:
			return false
		for number in unit.position + [unit.get("count"), unit.get("health"), unit.get("organization")]:
			if not number is float and not number is int:
				return false
			if not is_finite(number):
				return false
		if unit.get("order") != null:
			var command = unit.order
			if not command is Dictionary or not cities.has(command.get("targetCity", "")) or not command.get("route") is Array or command.route.is_empty():
				return false
			if command.route[-1] != command.targetCity or not command.route.all(func(id): return cities.has(id)) or not numeric(command.get("duration")) or command.duration <= 0:
				return false
			if not command.get("progress") is float and not command.get("progress") is int:
				return false
			if not command.get("from") is Array or command.from.size() != 2:
				return false
			if not command.from.all(numeric) or not countries.has(command.get("target", "")):
				return false
	for battle in value.battles:
		if not battle is Dictionary or not cities.has(battle.get("targetCity", "")) or not value.states.has(battle.get("attacker", "")) or not value.states.has(battle.get("defender", "")):
			return false
		if not battle.get("units") is Array or not battle.get("progress") is float and not battle.get("progress") is int or not battle.get("elapsed") is float and not battle.get("elapsed") is int:
			return false
	for item in value.queue:
		if not item is Dictionary or not unit_types.has(item.get("type", "")) or not value.states.has(item.get("owner", "")) or not numeric(item.get("progress")) or not numeric(item.get("duration")):
			return false
		if not item.get("id") is String or item.duration <= 0 or item.progress < 0:
			return false
	for item in value.research:
		if not item is Dictionary or not technologies.has(item.get("tech", "")) or not value.states.has(item.get("owner", "")) or not numeric(item.get("progress")) or not numeric(item.get("duration")):
			return false
		if item.duration <= 0 or item.progress < 0:
			return false
	for war in value.wars:
		if not war is Array or war.size() != 2 or not value.states.has(war[0]) or not value.states.has(war[1]):
			return false
	return true

func numeric(value: Variant) -> bool:
	return (value is int or value is float) and is_finite(float(value))

func save_game(path: String = SAVE_PATH) -> bool:
	var file = FileAccess.open(path + ".tmp", FileAccess.WRITE)
	if file == null:
		return false
	file.store_string(JSON.stringify(state))
	file.close()
	return DirAccess.rename_absolute(path + ".tmp", path) == OK

func load_game(path: String = SAVE_PATH) -> bool:
	if not FileAccess.file_exists(path):
		return false
	var value = JSON.parse_string(FileAccess.get_file_as_string(path))
	if not valid_save(value):
		return false
	state = value
	state.version = 3
	state.paused = true
	changed.emit()
	return true
