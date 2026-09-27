export interface EventBrowserMessages {
	title: string;
	skipToContent: string;
	viewLabel: string;
	listView: string;
	timelineView: string;
	cardsView: string;
	scheduleView: string;
	datesView: string;
	monthView: string;
	locationsView: string;
	browseIntro: string;
	previousMonth: string;
	nextMonth: string;
	filterLabel: string;
	allCategories: string;
	applyFilter: string;
	clearFilter: string;
	filteredBy: (category: string) => string;
	upcomingEvents: string;
	monthEvents: string;
	loading: string;
	feedUnavailable: string;
	tryAgain: string;
	empty: string;
	noEventsOnDay: string;
	eventCount: (count: number) => string;
	allDay: string;
	categories: string;
	organizer: string;
	directions: string;
	openEvent: string;
	eventDetails: string;
	externalWebsite: string;
	addToCalendar: string;
	backToEvents: string;
	eventNotFound: string;
	previous: string;
	next: string;
	backToToday: string;
	feedErrorDetail: string;
	locationToConfirm: string;
	eventsAtLocation: (location: string) => string;
	jumpToDate: string;
}

const messages: Record<string, EventBrowserMessages> = {
	en: {
		title: "Events",
		skipToContent: "Skip to event content",
		viewLabel: "View",
		listView: "List",
		timelineView: "Timeline",
		cardsView: "Cards",
		scheduleView: "Schedule",
		datesView: "Date strip",
		monthView: "Month",
		locationsView: "Locations",
		browseIntro: "Browse the month in the format that suits you.",
		previousMonth: "Previous month",
		nextMonth: "Next month",
		filterLabel: "Category",
		allCategories: "All categories",
		applyFilter: "Apply filter",
		clearFilter: "Clear filter",
		filteredBy: (category) => `Filtered by ${category}`,
		upcomingEvents: "Upcoming events",
		monthEvents: "Events this month",
		loading: "Loading events…",
		feedUnavailable: "Events are temporarily unavailable.",
		tryAgain: "Try again",
		empty: "No events are scheduled for this month.",
		noEventsOnDay: "No events on this day.",
		eventCount: (count) => `${count} ${count === 1 ? "event" : "events"}`,
		allDay: "All day",
		categories: "Categories",
		organizer: "Organized by",
		directions: "Directions",
		openEvent: "Event details",
		eventDetails: "Event details",
		externalWebsite: "Event website",
		addToCalendar: "Add to calendar",
		backToEvents: "Back to events",
		eventNotFound: "This event is unavailable or has been removed.",
		previous: "Previous",
		next: "Next",
		backToToday: "This month",
		feedErrorDetail: "The event feed could not be loaded. Please try again later.",
		locationToConfirm: "Location to be confirmed",
		eventsAtLocation: (location) => `Events at ${location}`,
		jumpToDate: "Jump to a date",
	},
	nl: {
		title: "Evenementen",
		skipToContent: "Ga naar de evenementen",
		viewLabel: "Weergave",
		listView: "Lijst",
		timelineView: "Tijdlijn",
		cardsView: "Kaarten",
		scheduleView: "Programma",
		datesView: "Datumstrip",
		monthView: "Maand",
		locationsView: "Locaties",
		browseIntro: "Bekijk de maand in de vorm die bij u past.",
		previousMonth: "Vorige maand",
		nextMonth: "Volgende maand",
		filterLabel: "Categorie",
		allCategories: "Alle categorieën",
		applyFilter: "Filter toepassen",
		clearFilter: "Filter wissen",
		filteredBy: (category) => `Gefilterd op ${category}`,
		upcomingEvents: "Aankomende evenementen",
		monthEvents: "Evenementen deze maand",
		loading: "Evenementen laden…",
		feedUnavailable: "Evenementen zijn tijdelijk niet beschikbaar.",
		tryAgain: "Opnieuw proberen",
		empty: "Er zijn deze maand geen evenementen gepland.",
		noEventsOnDay: "Geen evenementen op deze dag.",
		eventCount: (count) => `${count} ${count === 1 ? "evenement" : "evenementen"}`,
		allDay: "Hele dag",
		categories: "Categorieën",
		organizer: "Georganiseerd door",
		directions: "Routebeschrijving",
		openEvent: "Evenementdetails",
		eventDetails: "Evenementdetails",
		externalWebsite: "Website van het evenement",
		addToCalendar: "Toevoegen aan agenda",
		backToEvents: "Terug naar evenementen",
		eventNotFound: "Dit evenement is niet beschikbaar of is verwijderd.",
		previous: "Vorige",
		next: "Volgende",
		backToToday: "Deze maand",
		feedErrorDetail: "De evenementenkalender kon niet worden geladen. Probeer het later opnieuw.",
		locationToConfirm: "Locatie wordt nog bevestigd",
		eventsAtLocation: (location) => `Evenementen bij ${location}`,
		jumpToDate: "Ga naar een datum",
	},
	fr: {
		title: "Événements",
		skipToContent: "Aller au contenu des événements",
		viewLabel: "Affichage",
		listView: "Liste",
		timelineView: "Chronologie",
		cardsView: "Cartes",
		scheduleView: "Programme",
		datesView: "Dates",
		monthView: "Mois",
		locationsView: "Lieux",
		browseIntro: "Parcourez le mois dans le format qui vous convient.",
		previousMonth: "Mois précédent",
		nextMonth: "Mois suivant",
		filterLabel: "Catégorie",
		allCategories: "Toutes les catégories",
		applyFilter: "Appliquer le filtre",
		clearFilter: "Effacer le filtre",
		filteredBy: (category) => `Filtré par ${category}`,
		upcomingEvents: "Événements à venir",
		monthEvents: "Événements du mois",
		loading: "Chargement des événements…",
		feedUnavailable: "Les événements sont temporairement indisponibles.",
		tryAgain: "Réessayer",
		empty: "Aucun événement n’est prévu ce mois-ci.",
		noEventsOnDay: "Aucun événement ce jour-là.",
		eventCount: (count) => `${count} événement${count === 1 ? "" : "s"}`,
		allDay: "Toute la journée",
		categories: "Catégories",
		organizer: "Organisé par",
		directions: "Itinéraire",
		openEvent: "Détails de l’événement",
		eventDetails: "Détails de l’événement",
		externalWebsite: "Site de l’événement",
		addToCalendar: "Ajouter au calendrier",
		backToEvents: "Retour aux événements",
		eventNotFound: "Cet événement est indisponible ou a été supprimé.",
		previous: "Précédent",
		next: "Suivant",
		backToToday: "Ce mois-ci",
		feedErrorDetail: "Impossible de charger les événements. Veuillez réessayer plus tard.",
		locationToConfirm: "Lieu à confirmer",
		eventsAtLocation: (location) => `Événements à ${location}`,
		jumpToDate: "Aller à une date",
	},
};

export function messagesForLocale(locale: string): EventBrowserMessages {
	const language = locale.toLowerCase().split("-")[0] ?? "en";
	return messages[language] ?? messages.en!;
}

export function supportedMessages(): Readonly<Record<string, EventBrowserMessages>> {
	return messages;
}
