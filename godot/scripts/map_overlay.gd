extends Node2D

var map_view

func _draw():
	if map_view == null or map_view.campaign == null:
		return
	var game = map_view.campaign
	var zoom = map_view.zoom
	var font = ThemeDB.fallback_font
	var visible = Rect2(-map_view.offset / zoom, map_view.size / zoom).grow(5)
	# Project to world space, but rasterize glyphs at their screen size for clarity.
	for country in game.countries.values():
		if country.status != "independent" or not country.id in ["255", "365", "220", "200", "325", "290", "2", "740", "710", "900", "140", "640", "230", "380", "375"]:
			continue
		var point = map_view.project(country.center)
		if visible.has_point(point):
			draw_set_transform(point, 0, Vector2.ONE / zoom)
			var text = country.adjective
			var width = font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, 13).x
			draw_string(font, Vector2(-width / 2, -12), text, HORIZONTAL_ALIGNMENT_LEFT, -1, 13, Color(0.18, 0.24, 0.19, 0.85))
	draw_set_transform(Vector2.ZERO)
	for unit in game.state.units:
		if unit.owner != game.state.player and not game.enemy(game.state.player, unit.owner):
			continue
		if unit.order != null and unit.owner == game.state.player:
			var previous = map_view.project(unit.position)
			for id in unit.order.route.slice(1):
				var next = map_view.project(game.cities[id].position)
				draw_dashed_line(previous, next, Color("e4cc88"), 1.2 / zoom, 4.0 / zoom, true)
				previous = next
	for battle in game.state.battles:
		var point = map_view.project(game.cities[battle.targetCity].position)
		draw_circle(point, 7 / zoom, Color("ba6650"))
		draw_arc(point, 9 / zoom, -PI / 2, -PI / 2 + maxf(0.02, battle.progress / 100.0) * TAU, 20, Color("ecd191"), 2 / zoom, true)
	for item in map_view.unit_markers():
		var unit = item.unit
		var point = item.point
		if not visible.has_point(point):
			continue
		draw_set_transform(point, 0, Vector2.ONE / zoom)
		var own = unit.owner == game.state.player
		var rect = Rect2(-18, -9, 36, 18)
		draw_style_box(map_view.counter_style(own, unit.id in map_view.selected), rect)
		draw_string(font, Vector2(-14, 3), "%s %s" % [game.unit_types[unit.type].short, int(unit.count)], HORIZONTAL_ALIGNMENT_LEFT, -1, 10, Color("233325"))
		draw_rect(Rect2(-16, 6, 32 * unit.organization / 100.0, 2), Color("789453"))
	draw_set_transform(Vector2.ZERO)
	if map_view.show_cities:
		for city in game.cities.values():
			var point = map_view.project(city.position)
			if not visible.has_point(point) or (not city.capital and zoom < 3.0):
				continue
			var color = Color("d6e5b1") if game.owner(city.id) == game.state.player else Color("efbc99") if game.enemy(game.state.player, game.owner(city.id)) else Color("e5ddbb")
			draw_circle(point, 3.1 / zoom if city.capital else 2.2 / zoom, color)
			if city.id == map_view.target_city:
				draw_arc(point, 5.5 / zoom, 0, TAU, 20, Color("ffe2a1"), 1.5 / zoom, true)
			if zoom > 3 and (city.capital or city.country == map_view.inspected_country or zoom > 6):
				draw_set_transform(point, 0, Vector2.ONE / zoom)
				draw_string_outline(font, Vector2(7, 4), city.name, HORIZONTAL_ALIGNMENT_LEFT, -1, 10, 3, Color("34483a"))
				draw_string(font, Vector2(7, 4), city.name, HORIZONTAL_ALIGNMENT_LEFT, -1, 10, color)
				draw_set_transform(Vector2.ZERO)
