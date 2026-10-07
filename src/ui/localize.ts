import type { BlockResponse } from '@emdash-cms/blocks';
import { editorText } from './i18n';

/** Translate presentation, never IDs, form values, user copy or mutation payloads. */
export function localizeResponse(response: BlockResponse, locale = 'en'): BlockResponse {
  if(!locale.toLowerCase().startsWith('fr')) return response;
  const keys=new Set(['label','text','title','description','placeholder','empty_text','confirm','deny','message']);
  const verbatimOptions=new Set(['venueId','organizerId','venue','organizer_ref','imageMediaId','timezone','eventIds','events','venues','organizers']);
  const walk=(value: unknown, parent?: Record<string, unknown>): unknown => {
    if(Array.isArray(value)) return value.map(item=>walk(item,parent));
    if(!value || typeof value !== 'object') return value;
    const item=value as Record<string,unknown>;
    if(String(item.block_id).startsWith('eventual-verbatim')) return item;
    return Object.fromEntries(Object.entries(item).map(([key,child])=>{
      if(['value','initial_value','target','condition','patch'].includes(key)) return [key,child];
      if(key === 'options' && verbatimOptions.has(String(item.action_id))) return [key,(child as {value:string;label:string}[]).map(option=>option.value === '' ? {...option,label:editorText(option.label,locale)} : option)];
      // Table cells and directory/editorial button names are data, not UI copy.
      if(key === 'rows') return [key,child];
      if(key === 'label' && ['edit-organizer'].includes(String(item.action_id))) return [key,child];
      return [key,keys.has(key) && typeof child === 'string' ? editorText(child,locale) : walk(child,item)];
    }));
  };
  return walk(response) as BlockResponse;
}
