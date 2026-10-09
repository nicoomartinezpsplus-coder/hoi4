extends Control

signal city_selected(id: String)
signal unit_selected(id: String)
signal view_changed

const GeometryScript = preload("res://scripts/map_geometry.gd")
const OverlayScript = preload("res://scripts/map_overlay.gd")
var campaign
var geometry
var overlay
var content = Node2D.new()
var regions: Array = []
var selected: Array = []
var target_city = ""
var inspected_country = "255"
var zoom = 4.0
var offset = Vector2(-1700, -700)
var drag_origin = Vector2.ZERO
var initial_offset = Vector2.ZERO
var dragging = false
var moved = false
var show_cities = true
var layer = "political"
var control_snapshot: Dictionary = {}

func setup(game):
	campaign = game
	clip_contents = true
	mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	custom_minimum_size = Vector2(450, 350)
	size_flags_horizontal = Control.SIZE_EXPAND_FILL
	size_flags_vertical = Control.SIZE_EXPAND_FILL
	var data = JSON.parse_string(FileAccess.get_file_as_string("res://data/map.json"))
	regions = unpack(data.regions)
	geometry = GeometryScript.new()
	geometry.campaign = campaign
	geometry.regions = regions
	geometry.borders = unpack(data.borders)
	overlay = OverlayScript.new()
	overlay.map_view = self
	add_child(content)
	content.add_child(geometry)
	content.add_child(overlay)
	resized.connect(_resize_map)
	campaign.changed.connect(refresh)
	call_deferred("home")

func unpack(source: Array) -> Array:
	var result = []
	for item in source:
		var polygons = []
		for polygon in item.polygons:
			var rings = []
			for ring in polygon:
				var points = PackedVector2Array()
				for point in ring:
					points.append(Vector2(point[0], point[1]))
				if not points.is_empty():
					points.append(points[0])
				rings.append(points)
			polygons.append(rings)
		var meshes = []
		for mesh in item.meshes:
			var points = PackedVector2Array()
			for point in mesh.points:
				points.append(Vector2(point[0], point[1]))
			meshes.append({"points": points, "indices": PackedInt32Array(mesh.indices)})
		var bounds = item.bounds
		result.append({"id": item.id, "country": item.country, "polygons": polygons, "meshes": meshes, "bounds": Rect2(bounds[0], bounds[1], bounds[2] - bounds[0], bounds[3] - bounds[1])})
	return result

func project(position: Array) -> Vector2:
	var latitude = deg_to_rad(clampf(position[1], -85, 85))
	return Vector2(500 + deg_to_rad(position[0]) * 160, 350 + 160 * (log(tan(PI / 4 + deg_to_rad(20) / 2)) - log(tan(PI / 4 + latitude / 2))))

func _resize_map():
	apply_transform()

func apply_transform():
	content.position = offset
	content.scale = Vector2.ONE * zoom
	if overlay != null:
		overlay.queue_redraw()
	view_changed.emit()

func home():
	zoom = 4.0
	offset = size / 2 - project(campaign.countries[campaign.state.player].center) * zoom
	apply_transform()

func whole_world():
	zoom = minf(size.x / 1000, size.y / 680)
	offset = size / 2 - Vector2(500, 385) * zoom
	apply_transform()

func change_zoom(factor: float, anchor: Vector2 = Vector2(-1, -1)):
	if anchor.x < 0:
		anchor = size / 2
	var world = (anchor - offset) / zoom
	zoom = clampf(zoom * factor, 0.5, 13)
	offset = anchor - world * zoom
	apply_transform()

func refresh():
	if geometry == null:
		return
	if control_snapshot != campaign.state.cityControl or geometry.target_city != target_city or geometry.layer != layer or geometry.show_regions != show_cities:
		control_snapshot = campaign.state.cityControl.duplicate()
		geometry.target_city = target_city
		geometry.layer = layer
		geometry.show_regions = show_cities
		geometry.queue_redraw()
	overlay.queue_redraw()

func counter_style(own: bool, chosen: bool) -> StyleBoxFlat:
	var style = StyleBoxFlat.new()
	style.bg_color = Color("e6dec1") if own else Color("b47765")
	style.border_color = Color("ffda83") if chosen else Color("344a36")
	style.set_border_width_all(2 if chosen else 1)
	style.set_corner_radius_all(2)
	return style

func unit_markers() -> Array:
	var result = []
	var groups = {}
	for unit in campaign.state.units:
		if layer == "diplomatic" or (unit.owner != campaign.state.player and not campaign.enemy(campaign.state.player, unit.owner)):
			continue
		var key = "%s:%s" % [unit.city, unit.owner]
		var index = groups.get(key, 0)
		groups[key] = index + 1
		var point = project(unit.position) + Vector2((index % 3) * 40.0 / zoom - 8.0 / zoom, floor(index / 3.0) * 22.0 / zoom + 16.0 / zoom)
		result.append({"unit": unit, "point": point})
	return result

func hit_city(local: Vector2) -> String:
	var world = (local - offset) / zoom
	if show_cities:
		var nearest = ""
		var best = 7.0 / zoom
		for city in campaign.cities.values():
			if not city.capital and zoom < 3.0:
				continue
			var length = project(city.position).distance_to(world)
			if length < best:
				nearest = city.id
				best = length
		if not nearest.is_empty():
			return nearest
	for region in regions:
		if not region.bounds.has_point(world):
			continue
		for polygon in region.polygons:
			if Geometry2D.is_point_in_polygon(world, polygon[0]):
				var hole = false
				for ring in polygon.slice(1):
					hole = hole or Geometry2D.is_point_in_polygon(world, ring)
				if not hole:
					return region.id
	return ""

func _gui_input(event: InputEvent):
	if event is InputEventMouseButton:
		if event.button_index == MOUSE_BUTTON_WHEEL_UP and event.pressed:
			change_zoom(1.14, event.position)
		elif event.button_index == MOUSE_BUTTON_WHEEL_DOWN and event.pressed:
			change_zoom(1 / 1.14, event.position)
		elif event.button_index == MOUSE_BUTTON_LEFT or event.button_index == MOUSE_BUTTON_MIDDLE:
			if event.pressed:
				dragging = true
				moved = false
				drag_origin = event.position
				initial_offset = offset
			else:
				dragging = false
				if not moved and event.button_index == MOUSE_BUTTON_LEFT:
					select_at(event.position)
		accept_event()
	elif event is InputEventMouseMotion and dragging:
		if event.position.distance_to(drag_origin) > 5:
			moved = true
			offset = initial_offset + event.position - drag_origin
			apply_transform()
		accept_event()

func select_at(local: Vector2):
	# City points win over counters; the army list remains accessible for crowded cities.
	var world = (local - offset) / zoom
	if show_cities:
		for city in campaign.cities.values():
			if project(city.position).distance_to(world) < 6 / zoom and (city.capital or zoom >= 3):
				city_selected.emit(city.id)
				return
	var markers = unit_markers()
	markers.reverse()
	for marker in markers:
		if Rect2(marker.point - Vector2(18, 9) / zoom, Vector2(36, 18) / zoom).has_point(world):
			if marker.unit.owner == campaign.state.player:
				unit_selected.emit(marker.unit.id)
			else:
				city_selected.emit(marker.unit.city)
			return
	var city = hit_city(local)
	if not city.is_empty():
		city_selected.emit(city)

func _draw():
	draw_rect(Rect2(Vector2.ZERO, size), Color("31464a"))
