extends Node2D

var campaign
var regions: Array = []
var borders: Array = []
var target_city = ""
var layer = "political"
var show_regions = true

func controller_color(owner: String) -> Color:
	if layer != "political":
		if owner == campaign.state.player:
			return Color("899a70")
		if campaign.enemy(campaign.state.player, owner):
			return Color("a55e51")
		if owner in campaign.state.allies:
			return Color("648b97")
		return Color("596c60")
	return Color(campaign.countries[owner].color)

func _draw():
	if campaign == null:
		return
	for region in regions:
		var color = controller_color(campaign.owner(region.id))
		for mesh in region.meshes:
			RenderingServer.canvas_item_add_triangle_array(get_canvas_item(), mesh.indices, mesh.points, PackedColorArray([color]))
		if show_regions:
			for polygon in region.polygons:
				for ring in polygon:
					draw_polyline(ring, Color(0.9, 0.88, 0.74, 0.28), 0.12, true)
	for country in borders:
		for polygon in country.polygons:
			for ring in polygon:
				draw_polyline(ring, Color("c2c6ad"), 0.18, true)
	if not target_city.is_empty():
		for region in regions:
			if region.id == target_city:
				for polygon in region.polygons:
					for ring in polygon:
						draw_polyline(ring, Color("efd28d"), 0.65, true)
