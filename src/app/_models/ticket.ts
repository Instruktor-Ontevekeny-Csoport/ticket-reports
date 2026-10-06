// noinspection NonAsciiCharacters

export interface Ticket {
  accompanist: string;
  attendeeName: string;
  attendeeId: string;
  WooCommerceEventsTicketID: string;
  WooCommerceEventsStatus: string;
  WooCommerceEventsVariationID: string;
  WooCommerceEventsAttendeeName: string;
  coupon: string;
  WooCommerceEventsCustomAttendeeFields: Attendee;
}

export interface Attendee {
  'Fényképes igazolvány szám / ID number': string;
  'Név / Name': string;
  'Kísért személy neve / Name of accompanied person': string;
}
