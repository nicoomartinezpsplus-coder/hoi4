extends Control

const CampaignScript = preload("res://scripts/campaign.gd")
const MapScript = preload("res://scripts/world_map.gd")
const GOLD = Color("cfba7f")
const MUTED = Color("a8b39d")
const TEXT = Color("e0e5d7")
var campaign = CampaignScript.new()
var map_view
var selected: Array = []
var category = "land"
var inspected_country = "255"
var inspected_city = ""
var accumulated_hours = 0.0
var autosave_seconds = 0.0
var ui_seconds = 0.0
var dirty = true
var unit_signature = ""
var roster_signature = ""
var resources: Label
var date_label: Label
var status_label: Label
var pause_button: Button
var nation_label: Label
var strength_label: Label
var city_label: Label
var relation_label: Label
var event_label: Label
var toast: Label
var toast_remaining = 0.0
var unit_list: VBoxContainer
var city_list: VBoxContainer
var country_picker: OptionButton
var speed_buttons: Array = []
var dialog: AcceptDialog
var dialog_body: VBoxContainer
var dialog_kind = ""
var war_dialog: ConfirmationDialog
var pending_war = ""
var diplomacy_picker: OptionButton
var diplomacy_target = "305"
var diplomacy_status: Label
var help_dialog: AcceptDialog
var import_dialog: FileDialog

func _ready():
	_make_theme()
	_make_ui()
	campaign.changed.connect(func(): dirty = true)
	campaign.notified.connect(_notify)
	if FileAccess.file_exists(CampaignScript.SAVE_PATH):
		if not campaign.load_game():
			_notify("Сохранение повреждено. Начата новая кампания.", true)
	inspected_country = campaign.state.player
	_refresh()
	if "--ui-test" in OS.get_cmdline_user_args():
		call_deferred("_ui_test")

func _make_theme():
	var ui_theme = Theme.new()
	var ui_font = FontVariation.new()
	ui_font.base_font = load("res://fonts/manrope.ttf")
	ui_font.variation_opentype = {"wght": 500}
	ui_theme.default_font = ui_font
	ui_theme.default_font_size = 14
	for type in ["Label", "Button", "OptionButton", "CheckButton"]:
		ui_theme.set_color("font_color", type, TEXT)
		ui_theme.set_color("font_hover_color", type, GOLD)
		ui_theme.set_color("font_disabled_color", type, Color("697463"))
	ui_theme.set_color("font_pressed_color", "Button", GOLD)
	ui_theme.set_stylebox("normal", "Button", _style(Color("253022"), Color("48563b"), 5))
	ui_theme.set_stylebox("hover", "Button", _style(Color("33422b"), GOLD, 5))
	ui_theme.set_stylebox("pressed", "Button", _style(Color("394a2e"), GOLD, 5))
	ui_theme.set_stylebox("disabled", "Button", _style(Color("20281e"), Color("333e2d"), 5))
	ui_theme.set_stylebox("focus", "Button", _style(Color(0, 0, 0, 0), GOLD, 5))
	ui_theme.set_stylebox("normal", "OptionButton", _style(Color("253022"), Color("48563b"), 5))
	ui_theme.set_stylebox("panel", "PanelContainer", _style(Color("1b251c"), Color("394633"), 5))
	ui_theme.set_stylebox("panel", "AcceptDialog", _style(Color("172019"), Color("8c8055"), 5))
	ui_theme.set_stylebox("background", "ProgressBar", _style(Color("303e2b"), Color(0, 0, 0, 0), 3))
	ui_theme.set_stylebox("fill", "ProgressBar", _style(Color("a6b47b"), Color(0, 0, 0, 0), 3))
	ui_theme.set_constant("separation", "VBoxContainer", 10)
	ui_theme.set_constant("separation", "HBoxContainer", 10)
	theme = ui_theme

func _style(background: Color, border: Color, radius: int = 0) -> StyleBoxFlat:
	var style = StyleBoxFlat.new()
	style.bg_color = background
	style.border_color = border
	style.set_border_width_all(1)
	style.set_corner_radius_all(radius)
	style.content_margin_left = 12
	style.content_margin_right = 12
	style.content_margin_top = 9
	style.content_margin_bottom = 9
	return style

func _label(text: String, font_size: int = 13, color: Color = TEXT) -> Label:
	var label = Label.new()
	label.text = text
	label.add_theme_font_size_override("font_size", font_size)
	label.add_theme_color_override("font_color", color)
	return label

func _button(text: String, action: Callable) -> Button:
	var button = Button.new()
	button.text = text
	button.mouse_default_cursor_shape = CURSOR_POINTING_HAND
	button.focus_mode = FOCUS_NONE
	button.pressed.connect(action)
	return button

func _spacer() -> Control:
	var spacer = Control.new()
	spacer.size_flags_horizontal = SIZE_EXPAND_FILL
	return spacer

func _margin(child: Control, amount: int = 18) -> MarginContainer:
	var margin = MarginContainer.new()
	for side in ["left", "right", "top", "bottom"]:
		margin.add_theme_constant_override("margin_" + side, amount)
	margin.add_child(child)
	return margin

func _panel(child: Control) -> PanelContainer:
	var panel = PanelContainer.new()
	panel.add_child(child)
	return panel

func _clear(container: Node):
	for child in container.get_children():
		container.remove_child(child)
		child.queue_free()

func _make_ui():
	var background = ColorRect.new()
	background.color = Color("121c15")
	background.set_anchors_and_offsets_preset(PRESET_FULL_RECT)
	background.mouse_filter = MOUSE_FILTER_IGNORE
	add_child(background)
	var root = VBoxContainer.new()
	root.set_anchors_and_offsets_preset(PRESET_FULL_RECT)
	root.add_theme_constant_override("separation", 0)
	add_child(root)
	var header = HBoxContainer.new()
	var logo = _label("◈  I R O N F R O N T", 26, GOLD)
	logo.add_theme_font_override("font", load("res://fonts/barlow-condensed.ttf"))
	header.add_child(logo)
	header.add_child(_label("1936  ·  GODOT EDITION", 11, MUTED))
	header.add_child(_spacer())
	for item in [["Производство", "production"], ["Исследования", "research"], ["Дипломатия", "diplomacy"]]:
		header.add_child(_button(item[0], _open_panel.bind(item[1])))
	header.add_child(_button("?", _help))
	header.add_child(_button("Меню", _menu))
	root.add_child(_margin(header, 16))
	var metrics_row = HBoxContainer.new()
	country_picker = OptionButton.new()
	country_picker.custom_minimum_size.x = 210
	country_picker.focus_mode = FOCUS_NONE
	var country_ids = campaign.majors.duplicate()
	var remaining = campaign.state.states.keys().filter(func(id): return id not in country_ids)
	remaining.sort_custom(func(a, b): return campaign.countries[a].name < campaign.countries[b].name)
	country_ids.append_array(remaining)
	for id in country_ids:
		country_picker.add_item(campaign.countries[id].name)
		country_picker.set_item_metadata(country_picker.item_count - 1, id)
	country_picker.item_selected.connect(_choose_country)
	metrics_row.add_child(country_picker)
	resources = _label("", 13)
	resources.size_flags_horizontal = SIZE_EXPAND_FILL
	resources.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	metrics_row.add_child(resources)
	metrics_row.add_child(_label("1 ЯНВАРЯ 1936 · ИСТОРИЧЕСКАЯ КАРТА", 10, MUTED))
	root.add_child(_panel(_margin(metrics_row, 10)))
	var body = HBoxContainer.new()
	body.add_theme_constant_override("separation", 0)
	body.size_flags_vertical = SIZE_EXPAND_FILL
	root.add_child(body)
	var left = VBoxContainer.new()
	left.custom_minimum_size.x = 240
	left.size_flags_vertical = SIZE_EXPAND_FILL
	nation_label = _label("", 22)
	left.add_child(nation_label)
	left.add_child(_label("СТРАТЕГИЧЕСКОЕ КОМАНДОВАНИЕ", 10, MUTED))
	strength_label = _label("", 12, MUTED)
	left.add_child(strength_label)
	left.add_child(HSeparator.new())
	left.add_child(_label("Вооружённые силы", 16))
	var categories = HBoxContainer.new()
	for item in [["Армия", "land"], ["Авиация", "air"], ["Флот", "naval"]]:
		categories.add_child(_button(item[0], _change_category.bind(item[1])))
	left.add_child(categories)
	var select_row = HBoxContainer.new()
	select_row.add_child(_button("Выбрать все", _select_all))
	select_row.add_child(_button("Снять", _deselect_all))
	left.add_child(select_row)
	var scroll = ScrollContainer.new()
	scroll.size_flags_vertical = SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	unit_list = VBoxContainer.new()
	unit_list.size_flags_horizontal = SIZE_EXPAND_FILL
	scroll.add_child(unit_list)
	left.add_child(scroll)
	left.add_child(_button("Отменить приказы", func(): campaign.halt(selected)))
	left.add_child(_button("+ Подготовить подразделение", _open_panel.bind("production")))
	body.add_child(_margin(left, 14))
	var center = VBoxContainer.new()
	center.size_flags_horizontal = SIZE_EXPAND_FILL
	center.add_theme_constant_override("separation", 0)
	var map_toolbar = HBoxContainer.new()
	map_toolbar.add_child(_label("ОПЕРАЦИОННАЯ КАРТА", 10, MUTED))
	map_toolbar.add_child(_spacer())
	var layers = OptionButton.new()
	for title in ["Политическая", "Военная", "Дипломатическая"]:
		layers.add_item(title)
	layers.item_selected.connect(func(index):
		map_view.layer = ["political", "military", "diplomatic"][index]
		map_view.refresh())
	map_toolbar.add_child(layers)
	map_toolbar.add_child(_button("Города", func():
		map_view.show_cities = not map_view.show_cities
		map_view.refresh()))
	map_toolbar.add_child(_button("−", func(): map_view.change_zoom(0.8)))
	map_toolbar.add_child(_button("+", func(): map_view.change_zoom(1.25)))
	map_toolbar.add_child(_button("Домой", func(): map_view.home()))
	map_toolbar.add_child(_button("Мир", func(): map_view.whole_world()))
	center.add_child(_margin(map_toolbar, 8))
	map_view = MapScript.new()
	map_view.setup(campaign)
	map_view.city_selected.connect(_pick_city)
	map_view.unit_selected.connect(_select_unit)
	center.add_child(map_view)
	var map_hint = _label("Выберите войска слева → нажмите на город. Перетаскивание — обзор, колесо — масштаб.", 11, MUTED)
	center.add_child(_margin(map_hint, 9))
	event_label = _label("", 11, MUTED)
	event_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	event_label.custom_minimum_size.y = 68
	center.add_child(_panel(_margin(event_label, 10)))
	body.add_child(center)
	var right = VBoxContainer.new()
	right.custom_minimum_size.x = 245
	right.add_child(_label("Разведывательная сводка", 15))
	city_label = _label("", 13)
	city_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	right.add_child(_panel(city_label))
	relation_label = _label("", 12, MUTED)
	right.add_child(relation_label)
	right.add_child(_button("Дипломатия", _open_panel.bind("diplomacy")))
	right.add_child(_label("Города и области", 14))
	var city_scroll = ScrollContainer.new()
	city_scroll.size_flags_vertical = SIZE_EXPAND_FILL
	city_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	city_list = VBoxContainer.new()
	city_list.size_flags_horizontal = SIZE_EXPAND_FILL
	city_scroll.add_child(city_list)
	right.add_child(city_scroll)
	right.add_child(_label("479 реальных городов\nГраницы областей — игровые", 10, MUTED))
	body.add_child(_margin(right, 14))
	var footer = HBoxContainer.new()
	status_label = _label("", 11, GOLD)
	status_label.custom_minimum_size.x = 225
	footer.add_child(status_label)
	pause_button = _button("▶", func(): campaign.set_paused(not campaign.state.paused))
	pause_button.custom_minimum_size = Vector2(48, 40)
	footer.add_child(pause_button)
	date_label = _label("", 16)
	footer.add_child(date_label)
	footer.add_child(_spacer())
	footer.add_child(_label("СКОРОСТЬ", 10, MUTED))
	for speed in range(1, 6):
		var button = _button("%s×" % speed, _set_speed.bind(speed))
		button.toggle_mode = true
		speed_buttons.append(button)
		footer.add_child(button)
	footer.add_child(_button("Сохранить", _save))
	footer.add_child(_button("Загрузить", _load))
	root.add_child(_panel(_margin(footer, 12)))
	toast = _label("", 14, GOLD)
	toast.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	toast.set_anchors_and_offsets_preset(PRESET_TOP_WIDE)
	toast.position.y = 133
	toast.mouse_filter = MOUSE_FILTER_IGNORE
	toast.add_theme_color_override("font_shadow_color", Color.BLACK)
	toast.add_theme_constant_override("shadow_offset_x", 1)
	toast.add_theme_constant_override("shadow_offset_y", 1)
	add_child(toast)
	dialog = AcceptDialog.new()
	dialog.min_size = Vector2i(680, 450)
	dialog.get_ok_button().text = "Закрыть"
	dialog.theme = theme
	dialog_body = VBoxContainer.new()
	dialog_body.size_flags_horizontal = SIZE_EXPAND_FILL
	var dialog_scroll = ScrollContainer.new()
	dialog_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	dialog_scroll.add_child(dialog_body)
	dialog.add_child(dialog_scroll)
	add_child(dialog)
	dialog.visibility_changed.connect(func():
		if not dialog.visible:
			dialog_kind = "")
	war_dialog = ConfirmationDialog.new()
	war_dialog.title = "Объявление войны"
	war_dialog.get_ok_button().text = "Объявить войну"
	war_dialog.get_cancel_button().text = "Отмена"
	war_dialog.confirmed.connect(func(): campaign.diplomacy("war", pending_war))
	war_dialog.theme = theme
	add_child(war_dialog)
	help_dialog = AcceptDialog.new()
	help_dialog.theme = theme
	help_dialog.get_ok_button().text = "Понятно"
	add_child(help_dialog)
	import_dialog = FileDialog.new()
	import_dialog.file_mode = FileDialog.FILE_MODE_OPEN_FILE
	import_dialog.access = FileDialog.ACCESS_FILESYSTEM
	import_dialog.filters = PackedStringArray(["*.json ; Сохранение кампании"])
	import_dialog.file_selected.connect(func(path):
		if campaign.load_game(path):
			_reset_selection()
			_notify("Кампания импортирована. Время на паузе.", false)
		else:
			_notify("Файл не является подходящим сохранением.", true))
	add_child(import_dialog)

func _process(delta: float):
	if not campaign.state.paused:
		accumulated_hours += minf(delta, 0.25) * 6 * campaign.state.speed
		while accumulated_hours >= 1 and not campaign.state.paused:
			campaign.tick(1)
			accumulated_hours -= 1
	else:
		accumulated_hours = 0
	ui_seconds += delta
	autosave_seconds += delta
	if dirty and ui_seconds >= 0.2:
		_refresh()
		ui_seconds = 0
	if autosave_seconds >= 10:
		if not campaign.save_game():
			_notify("Не удалось сохранить кампанию на диск.", true)
		autosave_seconds = 0
	if toast_remaining > 0:
		toast_remaining -= delta
		if toast_remaining <= 0:
			toast.text = ""

func _unhandled_key_input(event: InputEvent):
	if not event is InputEventKey or not event.pressed or event.echo:
		return
	if dialog.visible or help_dialog.visible or war_dialog.visible or import_dialog.visible:
		return
	if event.keycode == KEY_SPACE:
		campaign.set_paused(not campaign.state.paused)
		get_viewport().set_input_as_handled()
	elif event.keycode >= KEY_1 and event.keycode <= KEY_5:
		_set_speed(event.keycode - KEY_1 + 1)
	elif event.keycode == KEY_ESCAPE:
		_deselect_all()
	elif event.keycode == KEY_F5:
		_save()
	elif event.keycode == KEY_F9:
		_load()

func _notification(what: int):
	if what == NOTIFICATION_WM_CLOSE_REQUEST:
		campaign.save_game()
		get_tree().quit()

func _notify(message: String, error: bool):
	toast.text = message
	toast.add_theme_color_override("font_color", Color("e69d89") if error else GOLD)
	toast_remaining = 5
	dirty = true

func _set_speed(speed: int):
	campaign.state.speed = speed
	dirty = true

func _choose_country(index: int):
	var id = str(country_picker.get_item_metadata(index))
	help_dialog.title = "Новая кампания"
	# Changing the country is an explicit new campaign, matching the browser edition.
	campaign.new_game(id)
	_reset_selection()
	map_view.home()
	_notify("Новая кампания: %s." % campaign.countries[id].name, false)

func _reset_selection():
	selected.clear()
	inspected_city = ""
	inspected_country = campaign.state.player
	unit_signature = ""
	roster_signature = ""
	map_view.target_city = ""
	map_view.selected = selected
	map_view.inspected_country = inspected_country
	map_view.refresh()
	dirty = true

func _change_category(value: String):
	category = value
	_deselect_all()
	unit_signature = ""
	dirty = true

func _select_unit(id: String):
	if id in selected:
		selected.erase(id)
	else:
		selected.append(id)
	map_view.selected = selected
	map_view.refresh()
	unit_signature = ""
	dirty = true

func _select_all():
	selected.clear()
	for unit in campaign.state.units:
		if unit.owner == campaign.state.player and campaign.unit_types[unit.type].category == category:
			selected.append(unit.id)
	unit_signature = ""
	map_view.selected = selected
	map_view.refresh()
	dirty = true

func _deselect_all():
	selected.clear()
	unit_signature = ""
	map_view.selected = selected
	map_view.refresh()
	dirty = true

func _pick_city(id: String):
	inspected_city = id
	inspected_country = campaign.cities[id].country
	map_view.target_city = id
	map_view.inspected_country = inspected_country
	map_view.refresh()
	if not selected.is_empty():
		campaign.order(selected, id)
	dirty = true

func _date(hours: float) -> String:
	# The campaign epoch is computed explicitly to avoid host-timezone dependency.
	var date = Time.get_datetime_dict_from_unix_time(Time.get_unix_time_from_datetime_string("1936-01-01T12:00:00") + int(hours * 3600))
	var months = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"]
	return "%02d %s %s  ·  %02d:00" % [date.day, months[date.month - 1], date.year, date.hour]

func _refresh():
	dirty = false
	var stats = campaign.state.states[campaign.state.player]
	nation_label.text = campaign.countries[campaign.state.player].name
	resources.text = "Резервы  %s     |     Заводы  %s     |     Топливо  %s     |     Влияние  %s     |     Снаряжение  %s" % [_number(stats.manpower), int(stats.industry), _number(stats.fuel), int(stats.political), int(stats.stock)]
	date_label.text = _date(campaign.state.hours)
	status_label.text = "ИГРА НА ПАУЗЕ  ·  ПРОБЕЛ" if campaign.state.paused else "ВРЕМЯ ИДЁТ  ·  %s×" % campaign.state.speed
	if not selected.is_empty():
		status_label.text = "Выбрано подразделений: %s" % selected.size()
	pause_button.text = "▶" if campaign.state.paused else "Ⅱ"
	for i in speed_buttons.size():
		speed_buttons[i].set_pressed_no_signal(i + 1 == campaign.state.speed)
	for i in country_picker.item_count:
		if country_picker.get_item_metadata(i) == campaign.state.player:
			country_picker.select(i)
	strength_label.text = "Армия %s  ·  Авиация %s  ·  Флот %s" % [campaign.total(campaign.state.player, "land"), campaign.total(campaign.state.player, "air"), campaign.total(campaign.state.player, "naval")]
	selected = selected.filter(func(id): return not campaign.unit_by_id(id).is_empty())
	map_view.selected = selected
	_refresh_units()
	_refresh_inspection()
	var lines = PackedStringArray(["СВОДКА СОБЫТИЙ"])
	for event in campaign.state.events.slice(0, 3):
		lines.append("•  " + event.text)
	event_label.text = "\n".join(lines)
	_refresh_dialog()

func _number(value: float) -> String:
	if value >= 1000000:
		return "%.2f млн" % (value / 1000000)
	if value >= 1000:
		return "%.1f тыс." % (value / 1000)
	return str(int(value))

func _refresh_units():
	var units = campaign.state.units.filter(func(u): return u.owner == campaign.state.player and campaign.unit_types[u.type].category == category)
	var signature = str(units.map(func(u): return [u.id, u.city, int(u.organization), int(u.health), u.order != null, u.id in selected]))
	if signature == unit_signature:
		return
	unit_signature = signature
	_clear(unit_list)
	for unit in units:
		var text = "%s  ·  %s\n%s  ·  %s\nЗдоровье %s%%  ·  Готовность %s%%" % [campaign.unit_types[unit.type].name, int(unit.count), campaign.cities[unit.city].name, "Приказ" if unit.order != null else "Ожидание", int(unit.health), int(unit.organization)]
		var button = _button(text, _select_unit.bind(unit.id))
		button.toggle_mode = true
		button.set_pressed_no_signal(unit.id in selected)
		button.alignment = HORIZONTAL_ALIGNMENT_LEFT
		button.add_theme_font_size_override("font_size", 11)
		button.custom_minimum_size.y = 70
		unit_list.add_child(button)
	if units.is_empty():
		unit_list.add_child(_label("Нет подразделений.\nПодготовьте новые войска.", 12, MUTED))

func _refresh_inspection():
	var country = campaign.countries[inspected_country]
	var controller = campaign.state.territories[inspected_country]
	if inspected_city.is_empty():
		city_label.text = "%s\n\n%s\nСтолица: %s" % [country.full, country.ideology, country.leader if country.has("leader") else country.name]
	else:
		var city = campaign.cities[inspected_city]
		controller = campaign.owner(inspected_city)
		var battle_text = ""
		for battle in campaign.state.battles:
			if battle.targetCity == inspected_city:
				battle_text = "\nСражение: %s%%" % int(battle.progress)
		city_label.text = "%s%s\n%s\n\nКонтроль: %s\n%s очков  ·  %s заводов\n%s  ·  гарнизон %s%s" % ["★ " if city.capital else "", city.name, country.name, campaign.countries[controller].name, int(city.victoryPoints), int(city.industry), "Порт" if city.coastal else "Сухопутный город", int(city.garrison), battle_text]
	relation_label.text = "Война" if campaign.enemy(campaign.state.player, controller) else "Союзник" if controller in campaign.state.allies else "Ваша территория" if controller == campaign.state.player else "Нейтралитет"
	var signature = inspected_country + str(campaign.by_country[inspected_country].map(func(id): return [id, campaign.owner(id), id == inspected_city]))
	if signature == roster_signature:
		return
	roster_signature = signature
	_clear(city_list)
	for id in campaign.by_country[inspected_country]:
		var city = campaign.cities[id]
		var text = "%s%s\n%s" % ["★ " if city.capital else "", city.name, campaign.countries[campaign.owner(id)].name]
		var button = _button(text, _pick_city.bind(id))
		button.add_theme_font_size_override("font_size", 11)
		button.alignment = HORIZONTAL_ALIGNMENT_LEFT
		button.toggle_mode = true
		button.set_pressed_no_signal(id == inspected_city)
		city_list.add_child(button)

func _open_panel(kind: String):
	dialog_kind = kind
	_clear(dialog_body)
	if kind == "diplomacy":
		var controller = campaign.owner(inspected_city) if not inspected_city.is_empty() else campaign.state.territories[inspected_country]
		if controller != campaign.state.player and campaign.state.states.has(controller):
			diplomacy_target = controller
		_make_diplomacy()
	elif kind == "production":
		_make_production()
	elif kind == "research":
		_make_research()
	dialog.popup_centered(Vector2i(730, 640))

func _make_production():
	dialog.title = "Производство и подготовка войск"
	dialog_body.add_child(_label("Подготовка продолжается, пока идёт игровое время.", 13, MUTED))
	var grid = GridContainer.new()
	grid.columns = 2
	grid.add_theme_constant_override("h_separation", 12)
	grid.add_theme_constant_override("v_separation", 12)
	for kind in campaign.unit_types:
		var data = campaign.unit_types[kind]
		var card = VBoxContainer.new()
		card.custom_minimum_size.x = 318
		card.add_child(_label(data.name, 17, GOLD))
		card.add_child(_label("%s дней  ·  %s снаряжения  ·  %s людей" % [int(data.days), int(data.cost), _number(data.men)], 11, MUTED))
		card.add_child(_button("+ Подготовить", campaign.train.bind(kind)))
		grid.add_child(_panel(card))
	dialog_body.add_child(grid)
	var queue_box = VBoxContainer.new()
	queue_box.name = "Queue"
	dialog_body.add_child(queue_box)
	_refresh_queue(queue_box)

func _refresh_queue(queue_box: VBoxContainer):
	_clear(queue_box)
	queue_box.add_child(_label("Очередь подготовки", 14))
	var count = 0
	for item in campaign.state.queue:
		if item.owner != campaign.state.player:
			continue
		count += 1
		var row = HBoxContainer.new()
		row.add_child(_label(campaign.unit_types[item.type].name, 11))
		var progress = ProgressBar.new()
		progress.value = item.progress / item.duration * 100
		progress.size_flags_horizontal = SIZE_EXPAND_FILL
		progress.show_percentage = false
		progress.custom_minimum_size = Vector2(160, 14)
		row.add_child(progress)
		row.add_child(_label("%s%%" % int(progress.value), 11, MUTED))
		row.add_child(_button("×", campaign.cancel_training.bind(item.id)))
		queue_box.add_child(row)
	if count == 0:
		queue_box.add_child(_label("Нет подразделений в подготовке.", 12, MUTED))

func _make_research():
	dialog.title = "Исследования"
	for id in campaign.technologies:
		var data = campaign.technologies[id]
		var card = VBoxContainer.new()
		card.add_child(_label(data.name, 18, GOLD))
		card.add_child(_label(data.description, 13))
		card.add_child(_label("%s дней  ·  %s снаряжения" % [int(data.days), int(data.cost)], 12, MUTED))
		var label = "Изучено" if id in campaign.state.states[campaign.state.player].technologies else "Исследовать"
		var active = campaign.state.research.filter(func(r): return r.owner == campaign.state.player)
		if not active.is_empty() and active[0].tech == id:
			label = "Исследуется: %s%%" % int(active[0].progress / active[0].duration * 100)
		var button = _button(label, campaign.research.bind(id))
		button.disabled = not active.is_empty() or id in campaign.state.states[campaign.state.player].technologies
		card.add_child(button)
		dialog_body.add_child(_panel(card))

func _make_diplomacy():
	dialog.title = "Дипломатия"
	dialog_body.add_child(_label("Выберите государство", 16))
	diplomacy_picker = OptionButton.new()
	var ids = campaign.state.states.keys()
	ids.sort_custom(func(a, b): return campaign.countries[a].name < campaign.countries[b].name)
	for id in ids:
		if id == campaign.state.player or id in campaign.state.defeated:
			continue
		diplomacy_picker.add_item(campaign.countries[id].name)
		diplomacy_picker.set_item_metadata(diplomacy_picker.item_count - 1, id)
		if id == diplomacy_target:
			diplomacy_picker.select(diplomacy_picker.item_count - 1)
	diplomacy_picker.item_selected.connect(func(index):
		diplomacy_target = str(diplomacy_picker.get_item_metadata(index))
		dirty = true)
	dialog_body.add_child(diplomacy_picker)
	diplomacy_status = _label("", 15, GOLD)
	dialog_body.add_child(diplomacy_status)
	dialog_body.add_child(_button("Улучшить отношения  ·  20 влияния", func(): campaign.diplomacy("relations", diplomacy_target)))
	dialog_body.add_child(_button("Заключить союз  ·  отношения +60", func(): campaign.diplomacy("alliance", diplomacy_target)))
	dialog_body.add_child(_button("Объявить войну  ·  50 влияния", _confirm_war))
	var text = _label("После объявления войны выберите подразделения и нажмите на город противника.\nДвижение идёт через соседние области. Для морского вторжения нужен флот и порт.", 13, MUTED)
	text.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	dialog_body.add_child(text)
	dirty = true

func _confirm_war():
	pending_war = diplomacy_target
	war_dialog.dialog_text = "Объявить войну государству %s?\nСтоимость: 50 влияния. Стабильность уменьшится на 3%%." % campaign.countries[pending_war].name
	war_dialog.popup_centered(Vector2i(520, 180))

func _refresh_dialog():
	if not dialog.visible:
		return
	if dialog_kind == "production":
		_refresh_queue(dialog_body.get_node("Queue"))
	elif dialog_kind == "research":
		_clear(dialog_body)
		_make_research()
	elif dialog_kind == "diplomacy" and is_instance_valid(diplomacy_status):
		diplomacy_status.text = "%s  ·  Отношения: +%s\n%s" % [campaign.countries[diplomacy_target].name, int(campaign.state.states[diplomacy_target].relation), "Война" if campaign.enemy(campaign.state.player, diplomacy_target) else "Союзник" if diplomacy_target in campaign.state.allies else "Нейтралитет"]

func _save():
	var saved = campaign.save_game()
	_notify("Кампания сохранена на диск." if saved else "Не удалось записать сохранение.", not saved)

func _load():
	if campaign.load_game():
		_reset_selection()
		map_view.home()
		_notify("Кампания загружена. Время на паузе.", false)
	else:
		_notify("Подходящего сохранения пока нет.", true)

func _menu():
	dialog_kind = "menu"
	dialog.title = "Меню кампании"
	_clear(dialog_body)
	dialog_body.add_child(_label("IRONFRONT · 1936\nСамостоятельная игра на Godot 4", 20, GOLD))
	dialog_body.add_child(_button("Сохранить кампанию", _save))
	dialog_body.add_child(_button("Загрузить кампанию", _load))
	dialog_body.add_child(_button("Импортировать JSON-сохранение v2 из браузерной версии", func(): import_dialog.popup_centered(Vector2i(850, 550))))
	dialog_body.add_child(_button("Новая кампания за текущую страну", func():
		campaign.new_game(campaign.state.player)
		_reset_selection()
		map_view.home()
		dialog.hide()))
	dialog_body.add_child(_button("Открыть папку сохранений", func(): OS.shell_open(ProjectSettings.globalize_path("user://"))))
	dialog_body.add_child(_button("Выйти из игры", func():
		campaign.save_game()
		get_tree().quit()))
	dialog.popup_centered(Vector2i(730, 540))

func _help():
	help_dialog.title = "Как играть"
	help_dialog.dialog_text = "Пробел / ▶ — пауза. Клавиши 1–5 — скорость. F5 — сохранить, F9 — загрузить.\n\nВыберите подразделения слева или на карте, затем нажмите на город/область.\nДля атаки сначала объявите войну в дипломатии. Приказы доступны на паузе.\n\nПехота, артиллерия и танки захватывают города. Авиация поддерживает бой\nв радиусе 2 500 км; флот действует в портах. Для морского вторжения нужен флот.\nНельзя перескочить через вражеские области. Противник контратакует.\n\nЗахват передаёт только выбранную область и её промышленность. Страна\nкапитулирует после потери всех городов, включая зависимые владения.\nЗахваченный порт позволяет строить корабли. Исследования усиливают армию.\n\n479 реальных городов. Границы стран — CShapes, 1 января 1936 года.\nГраницы внутренних областей игровые, исторические провинции не воссозданы.\nЧисленность войск и экономика упрощены. Сохранение автоматически каждые 10 с.\n\nПеретаскивайте карту мышью; колесо приближает. Кнопка «Мир» показывает весь мир.\nВыбор страны сверху начинает новую кампанию."
	help_dialog.popup_centered(Vector2i(820, 580))

func _ui_test():
	# Executed in the real renderer by the automated native UI smoke test.
	campaign.new_game()
	_reset_selection()
	await get_tree().process_frame
	await get_tree().process_frame
	map_view.home()
	var city_screen = map_view.get_global_transform() * (map_view.project(campaign.cities["305-salzburg"].position) * map_view.zoom + map_view.offset)
	_ui_click(city_screen)
	await get_tree().process_frame
	if not _ui_check(inspected_city == "305-salzburg", "city selection through real mouse input"):
		return
	_ui_key(KEY_SPACE)
	await get_tree().create_timer(0.4).timeout
	if not _ui_check(not campaign.state.paused and campaign.state.hours > 0, "Space starts continuous time"):
		return
	_ui_key(KEY_SPACE)
	await get_tree().process_frame
	var frozen = campaign.state.hours
	await get_tree().create_timer(0.3).timeout
	if not _ui_check(campaign.state.paused and campaign.state.hours == frozen, "Space pauses and freezes time"):
		return
	_refresh()
	await RenderingServer.frame_post_draw
	var image = get_viewport().get_texture().get_image()
	image.save_png("/tmp/ironfront-godot-desktop.png")
	_open_panel("production")
	await get_tree().process_frame
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png("/tmp/ironfront-godot-production.png")
	dialog.hide()
	if not _ui_check(campaign.diplomacy("war", "305"), "war declaration"):
		return
	_select_all()
	_ui_click(city_screen)
	await get_tree().process_frame
	campaign.state.paused = false
	for i in range(48):
		campaign.tick(1)
	if not _ui_check(campaign.owner("305-salzburg") == "255" and campaign.owner("305-capital") == "305", "individual city capture through the UI"):
		return
	if not _ui_check(not campaign.state.battles.any(func(b): return b.attacker == b.defender), "friendly reinforcements"):
		return
	campaign.set_paused(true)
	_refresh()
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png("/tmp/ironfront-godot-capture.png")
	print("NATIVE UI PASS: map rendered, production opened, troops selected, Salzburg captured, Vienna Austrian")
	get_tree().quit()

func _ui_check(condition: bool, message: String) -> bool:
	if not condition:
		push_error("NATIVE UI FAIL: " + message)
		get_tree().quit(1)
	return condition

func _ui_click(point: Vector2):
	for pressed in [true, false]:
		var event = InputEventMouseButton.new()
		event.position = point
		event.global_position = point
		event.button_index = MOUSE_BUTTON_LEFT
		event.pressed = pressed
		get_viewport().push_input(event)

func _ui_key(key: Key):
	var event = InputEventKey.new()
	event.keycode = key
	event.pressed = true
	get_viewport().push_input(event)
