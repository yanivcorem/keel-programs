// The scripted inbound stream that "Advance to next day" replays, one item per day.

export type ScriptedItem = {
  simDay: number;
  kind: "email" | "notes" | "form";
  fromName: string;
  subject: string;
  body: string;
  moment: 1 | 2 | null;
};

export const SCRIPT: ScriptedItem[] = [
  {
    simDay: 1,
    kind: "notes",
    fromName: "Dana Whitfield",
    subject: "Session notes: Kelpforge, week 5",
    body:
      "Met Priya and her co-founder today. The raise-now vs. wait disagreement came up again, more heated this time. " +
      "They talked over each other on the fundraising timeline and didn't agree on next steps. Product progress is fine. " +
      "I'd suggest someone from the program checks in with each of them separately this week.",
    moment: 1,
  },
  {
    simDay: 2,
    kind: "email",
    fromName: "Mateo Ruiz",
    subject: "Demo day slot",
    body:
      "Hi Sam, could Soilmind swap demo day slots with Tidewatt? Our lead investor contact can only attend the first slot. " +
      "Lena is cc'd. Thanks, Mateo\n\n" +
      "Reply from Lena Okafor (Tidewatt): Confirmed from our side, happy to take slot 2. Lena",
    moment: 2,
  },
  {
    simDay: 3,
    kind: "email",
    fromName: "Tomas Lindqvist",
    subject: "Intro to Greenline?",
    body:
      "Hi, could you introduce Gridlet to Noah Brennan at Greenline Capital? A warm intro from the program would really help us right now.",
    moment: null,
  },
  {
    simDay: 4,
    kind: "email",
    fromName: "Amara Diallo",
    subject: "Stipend advance",
    body:
      "Hi Sam, is it possible to get next month's stipend paid early? We have a supplier deposit due before the end of the month.",
    moment: null,
  },
];
