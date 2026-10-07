import { TIMEZONE_ERROR, TIMEZONE_UNAVAILABLE, DST_ERROR } from '../domain/messages';
import {nativeEditorText} from './native-messages';
// Shared English constants prevent duplicate UI strings in the sandbox bundle.
export const VENUES = "Venues";
export const ORGANIZERS = "Organizers";
export const SETTINGS = "Settings";
export const ADD_EVENT = "Add event";
export const EDIT_EVENT = "Edit event";
export const BACK_TO_EVENTS = "Back to events";
export const SAVE_EVENT = "Save event";
export const SAVE_DRAFT = "Save draft";
export const DELETE_EVENT = "Delete event";
export const DRAFT = "Draft";
export const PUBLISHED = "Published";
export const NO_EVENTS_YET = "No events yet";
export const PREVIOUS = "Previous";
export const NEXT = "Next";
export const TIMEZONE = "Timezone";
export const DEFAULT_TIMEZONE = "Default timezone";
export const END_DATE = "End date";
export const END_DATE_INCLUSIVE_FOR_ALL_DAY_EVENTS = "End date (inclusive for all-day events)";
export const LOCATION_NOTE = "Location note";
export const MONTHLY_SAME_DATE = "Monthly: same date";
export const MONTHLY_SAME_WEEKDAY = "Monthly: same weekday";
export const REPEAT_EVERY = "Repeat every";
export const DAYS_OF_THE_WEEK = "Days of the week";
export const REPEAT_THROUGH_INCLUSIVE = "Repeat through (inclusive)";
export const IF_THE_MONTH_HAS_NO_MATCHING_DAY = "If the month has no matching day";
export const USE_THE_LAST_DAY_OF_THE_MONTH = "Use the last day of the month";
export const WEEKDAY_POSITION_IN_MONTH = "Weekday position in month";
export const MORE_EVENT_DETAILS = "More event details";
export const EVENT_FORMAT = "Event format";
export const ORGANIZER_DISPLAY_NAME = "Organizer display name";
export const USE_FREE_TEXT = "Use free text";
export const CATEGORIES_COMMA_SEPARATED = "Categories (comma-separated)";
export const FEATURED_IMAGE = "Featured image";
export const NO_FEATURED_IMAGE = "No featured image";
export const VISIBLE_TO_VISITORS = "Visible to visitors";
export const MANAGE_OCCURRENCE_DATES = "Manage occurrence dates";
export const CHANGE_OCCURRENCE = "Change occurrence";
export const SAVE_OCCURRENCE = "Save occurrence";
export const CHANGE = "Change";
export const RESTORE = "Restore";
export const MORE_DATES = "More dates";
export const PREVIOUS_90_DAYS = "Previous 90 days";
export const NEXT_90_DAYS = "Next 90 days";
export const SHOW_OCCURRENCES_FROM = "Show occurrences from";
export const UPCOMING_OCCURRENCES = "Upcoming occurrences";
export const BACK_TO_EVENT_DETAILS = "Back to event details";
export const CANCEL_THIS_OCCURRENCE = "Cancel this occurrence?";
export const CANCEL_OCCURRENCE = "Cancel occurrence";
export const KEEP_OCCURRENCE = "Keep occurrence";
export const RESTORE_THE_ORIGINAL_OCCURRENCE = "Restore the original occurrence?";
export const KEEP_EXCEPTION = "Keep exception";
export const ADD_VENUE = "Add venue";
export const EDIT_VENUE = "Edit venue";
export const SAVE_VENUE = "Save venue";
export const DELETE_VENUE = "Delete venue";
export const ADD_ORGANIZER = "Add organizer";
export const EDIT_ORGANIZER = "Edit organizer";
export const SAVE_ORGANIZER = "Save organizer";
export const BACK_TO_ORGANIZERS = "Back to organizers";
export const PUBLIC_CONTACT_URL = "Public contact URL";
export const RELOAD_ORGANIZERS = "Reload organizers";
export const SAVE_SETTINGS = "Save settings";
export const TRANSLATIONS = "Translations";
export const TRANSLATION_LANGUAGE_CODE = "Translation language code";
export const SAVE_TRANSLATION = "Save translation";
export const REMOVE_TRANSLATION = "Remove translation";
export const REMOVE_TRANSLATION_2 = "Remove translation?";
export const REMOVE = "Remove";
export const TRANSLATION_NOT_SAVED = "Translation not saved";
export const EVENT_NOT_SAVED = "Event not saved";
export const UNABLE_TO_SAVE = "Unable to save";
export const TRANSLATE_THE_ANNOUNCEMENT_DATES_VENUE_AND_PUBLICATION_ARE_SHARED_SAVE_THE_MAIN_EVENT_FIRST = "Translate the announcement; dates and venue stay shared. Save the event first.";
export const THE_ORIGINAL_EVENT_WILL_REMAIN = "The original event will remain.";
export const ENTER_A_VALID_LANGUAGE_CODE_SUCH_AS_EN_OR_FR = "Enter a valid language code, such as en or fr.";
export const A_TRANSLATED_TITLE_IS_REQUIRED_CHECK_THE_TEXT_FIELDS = "A translated title is required. Check the text fields.";
export const EDIT_THE_ORIGINAL_LANGUAGE_IN_THE_MAIN_EVENT_FORM = "Edit the original language in the main event form.";
export const THIS_CHANGE_WILL_BE_SAVED_IMMEDIATELY = "This change will be saved immediately.";
export const EDIT_DATES_AND_REPEAT_SETTINGS_IN_EVENTUAL_SAVE_THE_ANNOUNCEMENT_FIRST = "Save your announcement, then edit dates in Eventual.";
export const OPEN_EVENTUAL = "Open Eventual";
export const OPEN_EMDASH_EDITOR = "Open EmDash editor";
export const OPEN_EMDASH_DIRECTORY = "Open EmDash directory";
export const SAVE_A_DRAFT_HERE_EDIT_THE_ANNOUNCEMENT_AND_PUBLISH_IN_EMDASH = "Save drafts here; edit copy and publish in EmDash.";
export const NATIVE_EVENTS_SAVE_A_DRAFT_HERE_PUBLISH_AND_TRANSLATE_IN_EMDASH = "Native events: save drafts here; publish in EmDash.";
export const MONDAY = "Monday";
export const TUESDAY = "Tuesday";
export const WEDNESDAY = "Wednesday";
export const THURSDAY = "Thursday";
export const FRIDAY = "Friday";
export const SATURDAY = "Saturday";
export const SUNDAY = "Sunday";
export const CANCEL = "Cancel";
export const EXCEPTIONS = "exceptions";
export const REPEAT = "Repeat";
export const ALL_DAY_EVENT = "All-day event";
export const START_DATE_2 = "Start date";
export const START_TIME = "Start time";
export const END_TIME = "End time";
export const DOES_NOT_REPEAT = "Does not repeat";
export const DAILY = "Daily";
export const WEEKLY = "Weekly";
export const DAY_OF_MONTH = "Day of month";
export const SKIP_THAT_MONTH = "Skip that month";
export const WEEKDAY = "Weekday";
export const FIRST = "First";
export const SECOND = "Second";
export const THIRD = "Third";
export const FOURTH = "Fourth";
export const FIFTH = "Fifth";
export const LAST = "Last";
export const SAVED_VENUE = "Saved venue";
export const SAVED_ORGANIZER = "Saved organizer";
export const NO_SAVED_VENUE = "No saved venue";
export const SHOW_DATES = "Show dates";
export const PREVIOUS_DATES = "Previous dates";
export const TITLE = "Title";
export const DESCRIPTION = "Description";
export const NAME = "Name";
export const STREET_ADDRESS = "Street address";
export const ADDRESS_LINE_2 = "Address line 2";
export const TOWN_OR_CITY = "Town or city";
export const REGION = "Region";
export const POSTAL_CODE = "Postal code";
export const COUNTRY = "Country";
export const WEBSITE = "Website";
export const EXTERNAL_IMAGE_URL = "External image URL";
export const ONLINE_MEETING_OR_STREAM_URL = "Online meeting or stream URL";
export const REGISTRATION_OR_EVENT_WEBSITE = "Registration or event website";
export const EVENT_STATUS = "Event status";
export const IN_PERSON = "In person";
export const ONLINE = "Online";
export const IN_PERSON_AND_ONLINE = "In person and online";
export const HAPPENING_AS_PLANNED = "Happening as planned";
export const CANCELLED = "Cancelled";
export const POSTPONED_NEW_DATE_TO_BE_CONFIRMED = "Postponed (new date to be confirmed)";
export const RESCHEDULED = "Rescheduled";
export const ENTER_A_VALID_DATE_AND_TIME = "Enter a valid date and time.";
export const ENTER_A_VALID_IANA_TIMEZONE_SUCH_AS_EUROPE_PARIS = TIMEZONE_ERROR;
export const THE_SELECTED_TIMEZONE_COULD_NOT_BE_APPLIED = TIMEZONE_UNAVAILABLE;
export const THAT_LOCAL_TIME_DOES_NOT_EXIST_BECAUSE_OF_A_DAYLIGHT_SAVING_CHANGE = DST_ERROR;
export const EVENTS = "Events";
export const EVENT = "Event";
export const EDIT = "Edit";
export const DUPLICATE = "Duplicate";
export const CALENDAR_SUBSCRIPTION_ICS = "Calendar subscription (.ics)";
export const PUBLISHED_EVENTS_JSON = "Published events (JSON)";
export const UPCOMING_EVENTS = "Upcoming events";
export const FEEDS_ACCEPT_LOCALE_STRICT_AND_CATEGORY_FILTERS = "Feeds accept locale, strict and category filters.";
export const INVALID_ADMIN_REQUEST = "Invalid admin request";
export const DIFFERENT_TITLE = "Different announcement title";
export const DIFFERENT_DESCRIPTION = "Different announcement description";
// The two arrays have matching positions. Keep all additions paired.
const french = new Map<string,string>([
['Events','Événements'],['Venues','Lieux'],['Organizers','Organisations'],['Settings','Paramètres'],['Event collection','Collection des événements'],['Venue collection','Collection des lieux'],['Organizer collection','Collection des organisations'],['Choose a collection','Choisir une collection'],['No collection','Aucune collection'],['Save settings','Enregistrer les paramètres'],['Default time zone','Fuseau horaire par défaut'],['Settings not saved','Paramètres non enregistrés'],['Collection setup guide','Guide de configuration des collections'],
['Connect Eventual to content types','Connecter Eventual aux types de contenu'],
['Events, venues and organizers are edited in EmDash content types. Choose their collections here. This does not move or delete any content.','Les événements, lieux et organisations sont gérés dans les types de contenu EmDash. Choisissez leurs collections ici. Aucun contenu ne sera déplacé ou supprimé.'],
['Choose or create native collections in Eventual settings. Eventual does not create events in private plugin storage. Existing legacy data is retained for an explicit migration.','Choisissez ou créez des collections natives dans les paramètres Eventual. Les anciennes données sont conservées pour une migration explicite.'],
['Create and edit these entries in the EmDash content editor.','Créez et modifiez ces éléments dans l’éditeur de contenu EmDash.'],
['Save announcement edits first. This panel updates the saved draft. Publish in core. Dates and venue are shared across languages.','Enregistrez d’abord l’annonce. Ce panneau modifie le brouillon enregistré. Publiez dans EmDash. Les dates et le lieu sont communs aux langues.'],
['Schedule saved as an EmDash draft. Publish in the content editor when ready.','Les dates sont enregistrées dans un brouillon EmDash. Publiez depuis l’éditeur de contenu lorsque vous êtes prêt.'],['Schedule draft saved.','Brouillon des dates enregistré.'],
['Create missing collections with the optional setup script or MCP guide. Ask your administrator; no Eventual frontend package is required.','Demandez à votre administrateur de créer les collections avec le script facultatif ou les instructions MCP du guide. Aucun module frontend Eventual n’est nécessaire.'],
['This event changed. Close and reopen the panel before trying again.','Cet événement a changé. Fermez puis rouvrez le panneau avant de réessayer.'],
['Review collection settings','Vérifier les collections'],
['No collection selected. Ask an administrator to configure it in Eventual settings.','Aucune collection sélectionnée. Demandez à un administrateur de la configurer.'],
['An administrator must manage Eventual collection settings.','Un administrateur doit gérer les collections Eventual.']
]);
export const ANNOUNCEMENT_LANGUAGE='Announcement language';
export function editorText(value:string,locale='en'):string {
 if(!locale.toLowerCase().startsWith('fr')) return value;
 if(value.startsWith('Use a different ')) {const name=value.slice(16);return 'Autre '+nativeEditorText(name[0]!.toUpperCase()+name.slice(1),locale).toLowerCase();}
 return french.get(value) ?? nativeEditorText(value,locale);
}
