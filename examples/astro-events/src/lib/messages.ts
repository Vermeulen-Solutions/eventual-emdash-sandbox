export interface EventBrowserMessages {
	title: string;
	skipToContent: string;
	viewLabel: string;
	listView: string;
	monthView: string;
	previousMonth: string;
	nextMonth: string;
	filterLabel: string;
	allCategories: string;
	applyFilter: string;
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
}

const messages: Record<string, EventBrowserMessages> = {
	en: {
		title: "Events",
		skipToContent: "Skip to event content",
		viewLabel: "View",
		listView: "List",
		monthView: "Month",
		previousMonth: "Previous month",
		nextMonth: "Next month",
		filterLabel: "Category",
		allCategories: "All categories",
		applyFilter: "Apply filter",
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
	},
	nl: {
		title: "Evenementen",
		skipToContent: "Ga naar de evenementen",
		viewLabel: "Weergave",
		listView: "Lijst",
		monthView: "Maand",
		previousMonth: "Vorige maand",
		nextMonth: "Volgende maand",
		filterLabel: "Categorie",
		allCategories: "Alle categorieën",
		applyFilter: "Filter toepassen",
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
	},
	fr: {
		title: "Événements",
		skipToContent: "Aller au contenu des événements",
		viewLabel: "Affichage",
		listView: "Liste",
		monthView: "Mois",
		previousMonth: "Mois précédent",
		nextMonth: "Mois suivant",
		filterLabel: "Catégorie",
		allCategories: "Toutes les catégories",
		applyFilter: "Appliquer le filtre",
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
	},
};

export function messagesForLocale(locale: string): EventBrowserMessages {
	const language = locale.toLowerCase().split("-")[0] ?? "en";
	return messages[language] ?? messages.en!;
}

export function supportedMessages(): Readonly<Record<string, EventBrowserMessages>> {
	return messages;
}
