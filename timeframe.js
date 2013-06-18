/* Timeframe, version 0.3.1
 * (c) 2008-2011 Stephen Celis
 * (c) 2012 Kyle Konrad
 * Freely distributable under the terms of an MIT-style license.
 * ------------------------------------------------------------- */

// Checks for localized Datejs before defaulting to 'en-US'
var Locale = {
	format:     (typeof Date.CultureInfo == 'undefined' ? '%b %d, %Y' : Date.CultureInfo.formatPatterns.shortDate),
	monthNames: (typeof Date.CultureInfo == 'undefined' ? $(['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']) : Date.CultureInfo.monthNames),
	dayNames:   (typeof Date.CultureInfo == 'undefined' ? $(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']) : Date.CultureInfo.dayNames),
	weekOffset: (typeof Date.CultureInfo == 'undefined' ? 0 : Date.CultureInfo.firstDayOfWeek)
};

var Timeframes = [];

function Timeframe() {
	var me = this;
	var Version = '0.3';

	this.initialize = function(element, options) {
		Timeframes.push(me);

		me.element = $(element);
		me.element.addClass('timeframe_calendar');
		me.options = options || {};
		if (typeof me.options.months === 'undefined') {
			me.options.months = 2;
		}
		me.months = me.options['months'];

		me.weekdayNames = Locale['dayNames'];
		me.monthNames   = Locale['monthNames'];
		me.format       = me.options['format']     || Locale['format'];
		me.weekOffset   = me.options['weekOffset'] || Locale['weekOffset'];
		me.maxRange = me.options['maxRange'];
		me.minRange = me.options['minRange'];

		me.firstDayId = me.element.attr('id') + '_firstday';
		me.lastDayId = me.element.attr('id') + '_lastday';

		me.scrollerDelay = 0.5;

		me.buttons = {
			previous: { label: '&larr;', element: me.options['previousButton'] },
			today:    { label: 'T',      element: me.options['todayButton'] },
			reset:    { label: 'R',      element: me.options['resetButton'] },
			next:     { label: '&rarr;', element: me.options['nextButton'] }
		};
		me.fields = { start: me.options['startField'], end: me.options['endField'] };

		me.range = {};
		me.earliest = (typeof me.options.earliest === 'object' ? me.options.earliest : Date.parseToObject(me.options.earliest));
		me.latest = (typeof me.options.latest === 'object' ? me.options.latest : Date.parseToObject(me.options.latest));
		if (me.earliest && me.latest && me.earliest > me.latest) {
			throw new Error("Timeframe: 'earliest' cannot come later than 'latest'");
		}

		me._buildButtons()._buildFields();

		me.calendars = [];
		me.element.append($('<div>').attr('id', me.element.attr('id') + '_container'));
		var months = me.months;
		for (var month = 0 ; month < months ; ++month) {
			me.createCalendar(month);
		}

		me.calendars[0].select('td').first().attr('id', me.firstDayId);
		me.calendars[me.calendars.length-1].select('td').last().attr('id', me.lastDayId);

		me.register().populate().refreshRange();
	};

	// Scaffolding

	this.createCalendar = function() {
		var calendar = $('<table>', {
			id: me.element.attr('id') + '_calendar_' + me.calendars.length, border: 0, cellspacing: 0, cellpadding: 5
		});
		calendar.append($('<caption>'));

		var head = $('<thead>');
		var row  = $('<tr>');
		for (var column = 0 ; column < me.weekdayNames.length ; ++column) {
			var weekday = me.weekdayNames[(column + me.weekOffset) % 7];
			var cell = $('<th>', { scope: 'col', abbr: weekday }).text(weekday.substring(0,1));
			row.append(cell);
		}
		head.append(row);
		calendar.append(head);

		var body = $('<tbody>');
		for (var rowNumber = 0 ; rowNumber < 6 ; ++rowNumber) {
			var row = $('<tr>');
			for (var column = 0 ; column < me.weekdayNames.length ; ++column) {
				var cell = $('<td>');
				row.append(cell);
			}
			body.append(row);
		}
		calendar.append(body);

		me.element.find('#' + me.element.attr('id') + '_container').append(calendar);
		me.calendars.push(calendar);
		me.months = me.calendars.length;

		return me;
	};

	this.destroyCalendar = function() {
		me.calendars.pop().remove();
		me.months = me.calendars.length;
		return me;
	};

	this.populate = function() {
		var month = me.date.neutral();
		month.setDate(1);

		if (me.earliest === null || me.earliest < month) {
			me.buttons['previous']['element'].removeClass('disabled');
		} else {
			me.buttons['previous']['element'].addClass('disabled');
		}

		$.each(me.calendars, function(i, calendar) {
			var caption = calendar.find('caption').first();
			caption.text(me.monthNames[month.getMonth()] + ' ' + month.getFullYear());

			var iterator = new Date(month);
			var offset = (iterator.getDay() - me.weekOffset) % 7;
			var inactive = offset > 0 ? 'pre beyond' : false;
			iterator.setDate(iterator.getDate() - offset);

			if (iterator.getDate() > 1 && !inactive) {
				iterator.setDate(iterator.getDate() - 7);
				if (iterator.getDate() > 1) {
					inactive = 'pre beyond';
				}
			}

			$.each(calendar.find('td'), function(i, day) {
				var $day = $(day);
				day.date = new Date(iterator); // Is me expensive (we unload these later)? We could store the epoch time instead.
				$day.text(day.date.getDate()).attr('class', inactive || 'active');

				if ((me.earliest && day.date < me.earliest) || (me.latest && day.date > me.latest)){
					$day.addClass('unselectable');
				} else{
					$day.addClass('selectable');
				}

				if (iterator.toString() === new Date().neutral().toString()) {
					$day.addClass('today');
				}

				$day.attr('baseClass', $day.attr('class'));

				iterator.setDate(iterator.getDate() + 1);
				if (iterator.getDate() == 1) {
					inactive = inactive ? false : 'post beyond';
				}
			});

			month.setMonth(month.getMonth() + 1);
		});

		if (me.latest === null || me.latest > month) {
			me.buttons['next']['element'].removeClass('disabled');
		} else {
			me.buttons['next']['element'].addClass('disabled');
		}

		return me;
	};

	this._buildButtons = function() {
		var buttonList = $('<ul>', { id: me.element.attr('id') + '_menu', class: 'timeframe_menu' });

		$.each(me.buttons, function(key, value) {
			if (value['element']) {
				value['element'].addClass('timeframe_button').addClass(key);
			} else {
				var item = $('<li>');
				var button = $('<a>', { class: 'timeframe_button ' + key, href: '#', onclick: 'return false;' }).append(value['label']);
				button.onclick = function() { return false; };
				value['element'] = button;
				item.append(button);
				buttonList.append(item);
			}
		});

		if (buttonList.children().length > 0) {
			me.element.append(buttonList);
		}

		me.clearButton = $('<span>', { class: 'clear' }).append($('<span>').append('X'));
		return me;
	};

	this._buildFields = function() {
		var fieldset = $('<div>', { id: me.element.attr('id') + '_fields', class: 'timeframe_fields' });

		$.each(me.fields, function(key, value) {
			if (value)
				value.addClass('timeframe_field').addClass(key);
			else {
				var container = $('<div>', { id: key + me.element.attr('id') + '_field_container' });
				me.fields[key] = $('<input>', { id: me.element.attr('id') + '_' + key + 'field', name: key + 'field', type: 'text', value: '' });
				container.append($('<label>', { 'for': key + 'field' }).append(key));
				container.append(me.fields[key]);
				fieldset.append(container);
			}
		});

		if (fieldset.children().length > 0) {
			me.element.append(fieldset);
		}
		me.parseField('start').refreshField('start').parseField('end').refreshField('end').initDate = new Date(me.date);

		return me;
	};

	// Event registration

	this.register = function() {
		$(document).click(me.eventClick);
		me.element.mousedown(me.eventMouseDown);
		me.element.mouseover(me.eventMouseOver);
		$(me.firstDayId).mouseout(me.clearTimer);
		$(me.lastDayId).mouseout(me.clearTimer);
		$(document).mouseup(me.eventMouseUp);
		$(document).unload(me.unregister);

		// mousemove listener for Opera in _disableTextSelection
		return me._registerFieldObserver('start')._registerFieldObserver('end')._disableTextSelection();
	};

	this.unregister = function() {
		me.element.select('td').each(function(day) { day.date = day.baseClass = null; });
	};

	this._registerFieldObserver = function(fieldName) {
		var field = me.fields[fieldName];
		field.focus(function() { field.hasFocus = true; me.parseField(fieldName, true); });
		field.blur(function() { me.refreshField(fieldName); });
		field.change(function() { me.parseField(fieldName, true); });
		return me;
	};

	this._disableTextSelection = function() {
		/*
		 if (Prototype.Browser.IE) {
		 me.element.onselectstart = function(event) {
		 if (!/input|textarea/i.test(Event.element(event).tagName)) return false;
		 };
		 } else if (Prototype.Browser.Opera)
		 document.observe('mousemove', me.handleMouseMove);
		 else {
		 */
		me.element.onmousedown = function(event) {
			if (!/input|textarea/i.test(Event.element(event).tagName)) return false;
		};
//    }
		return me;
	};

	// Fields

	this.parseField = function(fieldName, populate) {
		var field = me.fields[fieldName];
		var date = Date.parseToObject(me.fields[fieldName].val());
		var failure = me.validateField(fieldName, date);

		if (failure != 'hard') {
			me.range[fieldName] = date;
			field.removeClass('error');
		} else if (field.hasFocus) {
			field.addClass('error');
		}

		var date = Date.parseToObject(me.range[fieldName]);
		me.date = date || new Date();

		if (me.earliest && me.earliest > me.date) {
			me.date = new Date(me.earliest);
		} else if (me.latest) {
			date = new Date(me.date);
			date.setMonth(date.getMonth() + (me.months - 1));
			if (date > me.latest) {
				me.date = new Date(me.latest);
				me.date.setMonth(me.date.getMonth() - (me.months - 1));
			}
		}

		me.date.setDate(1);
		if (populate && date) {
			me.populate();
		}
		me.refreshRange();

		return me;
	};

	this.refreshField = function(fieldName) {
		var field = me.fields[fieldName];
		var initValue = field.val();

		if (me.range[fieldName]) {
			field.val(typeof Date.CultureInfo == 'undefined' ?
				me.range[fieldName].strftime(me.format) :
				me.range[fieldName].toString(me.format));
		} else {
			field.val('');
		}

		field.hasFocus && field.val() == '' && initValue != '' ? field.addClass('error') : field.removeClass('error');
		field.hasFocus = false;

		return me;
	};

	this.validateField = function(fieldName, date) {
		if (!date) return '';

		var error;
		if ((me.earliest && date < me.earliest) || (me.latest && date > me.latest)){
			error = 'hard';

		} else if (fieldName == 'start' && me.range['end'] && date > me.range['end']){
			error = 'soft';

		} else if (fieldName == 'end' && me.range['start'] && date < me.range['start']) {
			error = 'soft';
		}

		return error;
	};

	// Event handling

	this.eventClick = function(event) {
		var el;
		if (el = $(event.target).closest('a.timeframe_button')) {
			me.handleButtonClick(event, el);
		}
	};

	this.eventMouseDown = function(event) {
		var el, em;
		el = $(event.target).closest('span.clear');
		if (el.length) {
			el.find('span').addClass('active');
			em = $(event.target).closest('td.selectable');
			if (em.length) {
				me.handleDateClick(em, true);
			}
		} else {
			el = $(event.target).closest('td.selectable');
			if (el.length) {
				me.handleDateClick(el);
			}
		}
		return false;
	};

	this.handleButtonClick = function(event, element) {
		var movement = me.months > 1 ? me.months - 1 : 1;

		if (element.hasClass('next')) {
			if (!me.buttons['next']['element'].hasClass('disabled')) {
				me.date.setMonth(me.date.getMonth() + movement);
			}

		} else if (element.hasClass('previous')) {
			if (!me.buttons['previous']['element'].hasClass('disabled')) {
				me.date.setMonth(me.date.getMonth() - movement);
			}

		} else if (element.hasClass('today')) {
			me.date = new Date();

		} else if (element.hasClass('reset')) {
			me.reset();
		}

		me.populate().refreshRange();
	};

	this.reset = function() {
		me.fields['start'].val(me.fields['start'].defaultValue || '');
		me.fields['end'].val(me.fields['end'].defaultValue || '');
		me.date = new Date(me.initDate);
		me.parseField('start').refreshField('start').parseField('end').refreshField('end');
	};

	this.clear = function() {
		me.clearRange();
		me.refreshRange();
	};

	this.handleDateClick = function(element, couldClear) {
		me.mousedown = me.dragging = true;
		if (me.stuck) {
			me.stuck = false;
			return;

		} else if (couldClear) {
			if (!element.hasClass('startrange')) return;

		} else if (me.maxRange != 1) {
			me.stuck = true;
			setTimeout(function() { if (me.mousedown) me.stuck = false; }, 200);
		}

		me.getPoint(element[0].date);
	};

	this.getPoint = function(date) {
		if (me.range['start'] && me.range['start'].toString() == date && me.range['end']){
			me.startdrag = me.range['end'];

		} else {
			me.clearButton.hide();

			if (me.range['end'] && me.range['end'].toString() == date){
				me.startdrag = me.range['start'];
			} else {
				me.startdrag = me.range['start'] = me.range['end'] = date;
			}
		}

		me.validateRange(me.range['start'], me.range['end']);
		me.refreshRange();
	};

	this.eventMouseOver = function(event) {
		var el;
		if (!me.dragging){
			me.toggleClearButton(event);

		} else if ($(event.target).closest('span.clear span.active').length) {

		} else {
			el = $(event.target).closest('td.selectable');

			if (el.length) {
				window.clearInterval(me.timer);

				if (el.attr('id') == me.lastDayId) {
					me.timer = window.setInterval(function() {
						if (!me.buttons['next']['element'].hasClass('disabled')) {
							me.date.setMonth(me.date.getMonth() + 1);
							me.populate().refreshRange();
						}
					}, me.scrollerDelay * 1000);

				} else if (el.attr('id') == me.firstDayId) {
					me.timer = window.setInterval(function() {
						if (!me.buttons['previous']['element'].hasClass('disabled')) {
							me.date.setMonth(me.date.getMonth() - 1);
							me.populate().refreshRange();
						}
					}, me.scrollerDelay * 1000);
				}

				me.extendRange(el[0].date);

			} else {
				me.toggleClearButton(event);
			}
		}
	};

	this.clearTimer = function(event) {
		window.clearInterval(me.timer);
		return me;
	};

	this.toggleClearButton = function(event) {
		var el;

		if (/*event.element().ancestors && */$(event.target).closest('td.selected').length) {
			el = me.element.find('#' + me.calendars[0].attr('id') +  ' .pre.selected').first();
			if (!el.length) el = me.element.find('.active.selected').first();
			if (!el.length) el = me.element.find('.post.selected').first();
			if (el.length) el.prepend(me.clearButton);
			me.clearButton.show().find('span').first().removeClass('active');

		} else {
			me.clearButton.hide();
		}
	};

	this.extendRange = function(date) {
		var start, end;
		me.clearButton.hide();

		if (date > me.startdrag) {
			start = me.startdrag;
			end = date;

		} else if (date < me.startdrag) {
			start = date;
			end = me.startdrag;

		} else {
			start = end = date;
		}
		me.validateRange(start, end);
		me.refreshRange();
	};

	this.validateRange = function(start, end) {
		var days = parseInt((end - start) / 86400000);

		if (me.maxRange) {
			var range = me.maxRange - 1;
			if (days > range) {
				if (start == me.startdrag) {
					end = new Date(me.startdrag);
					end.setDate(end.getDate() + range);
				} else {
					start = new Date(me.startdrag);
					start.setDate(start.getDate() - range);
				}
			}
		}

		if (me.minRange) {
			var range = me.minRange - 1;
			var flag = true;
			if (days <= range) {
				if (start != me.startdrag) {
					start = new Date(me.startdrag);
					start.setDate(start.getDate() - range);
					flag = start < me.earliest;
				}
				if (flag) {
					start = new Date(me.startdrag);
					end = new Date(me.startdrag);
					end.setDate(end.getDate() + range);
				}
			}
		}

		me.range['start'] = start;
		me.range['end'] = end;
	};

	this.eventMouseUp = function(event) {
		if (!me.dragging) return;

		if (!me.stuck) {
			me.dragging = false;
			if (me.timer) {
				clearInterval(me.timer);
			}

			if ($(event.target).closest('span.clear span.active').length) {
				me.clearRange();
			} else if ('onFinished' in me.options) {
				me.options['onFinished']();
			}
		}
		me.mousedown = false;
		me.refreshRange();
	};

	this.clearRange = function() {
		me.clearButton.hide().find('span').first().removeClass('active');
		me.range['start'] = me.range['end'] = null;
		me.refreshField('start').refreshField('end');
		if ('onClear' in me.options) {
			me.options['onClear']();
		}
	};

	this.refreshRange = function() {
		$.each(me.element.find('td'), function(i, day) {
			var $day = $(day);
			$day.attr('class', $day.attr('baseClass'));

			if (me.range['start'] && me.range['end'] && me.range['start'] <= day.date && day.date <= me.range['end']) {
				var baseClass = $day.hasClass('beyond') ? 'beyond_' : $day.hasClass('today') ? 'today_' : null;
				var state = me.stuck || me.mousedown ? 'stuck' : 'selected';

				if (baseClass) {
					$day.addClass(baseClass + state);
				}
				$day.addClass(state);

				var rangeClass = '';
				if (me.range['start'].toString() == day.date) {
					rangeClass += 'start';
				}

				if (me.range['end'].toString() == day.date) {
					rangeClass += 'end';
				}

				if (rangeClass.length > 0) {
					$day.addClass(rangeClass + 'range');
				}
			}
			/*
			 if (Prototype.Browser.Opera) {
			 day.unselectable = 'on'; // Trick Opera into refreshing the selection (FIXME)
			 day.unselectable = null;
			 }
			 */
		});

		if (me.dragging) {
			me.refreshField('start').refreshField('end');
		}
	};

	this.setRange = function(start, end) { // TODO
		var range = { start: start, end: end };

		$.each(range, function(key, value) {
			me.range[key] = Date.parseToObject(value);
			me.refreshField(key);
			me.parseField(key, true);
		});

		return me;
	};

	this.handleMouseMove = function(event) {
		if ($(event.target).closest('#' + me.element.attr('id') + ' td')) {
			window.getSelection().removeAllRanges();
		} // More Opera trickery
	};
}

$.extend(Date, {
	parseToObject: function(string) {
		var date = Date.parse(string);

		if (!date) {
			return null;
		}
		date = new Date(date);
		return (date == 'Invalid Date' || date == 'NaN') ? null : date.neutral();
	}
});

$.extend(Date.prototype, {
	// modified from http://alternateidea.com/blog/articles/2008/2/8/a-strftime-for-prototype
	strftime: function(format) {
		var me = this;
		var day = me.getDay(), month = me.getMonth();
		var hours = me.getHours(), minutes = me.getMinutes();
		function pad(num) { return num < 10 ? '0'+num : ''+num; };

		return format.replace(/\%([aAbBcdHImMpsSwyY])/g, function(part) {
			switch(part[1]) {
				case 'a': return Locale['dayNames'][day].substring(0, 3); break;
				case 'A': return Locale['dayNames'][day]; break;
				case 'b': return Locale['monthNames'][month].substring(0, 3); break;
				case 'B': return Locale['monthNames'][month]; break;
				case 'c': return me.toString(); break;
				case 'd': return pad(me.getDate()); break;
				case 'H': return pad(hours); break;
				case 'I': return (hours % 12 == 0) ? 12 : pad(hours % 12); break;
				case 'm': return pad(month + 1); break;
				case 'M': return pad(minutes); break;
				case 'p': return hours >= 12 ? 'PM' : 'AM'; break;
				case 's': return me.getTime()/1000;
				case 'S': return pad(me.getSeconds()); break;
				case 'w': return day; break;
				case 'y': return pad(me.getFullYear() % 100); break;
				case 'Y': return me.getFullYear().toString(); break;
			}
		});
	},

	neutral: function() {
		var me = this;
		return new Date(me.getFullYear(), me.getMonth(), me.getDate(), 12);
	}
});
