// Sample data for the /preview route only. Shapes match the loop model in
// docs/PRD.md Section 6; nothing here is read by the real app or persisted
// anywhere.
export const mockInboxLoops = [
  {
    id: 'loop-inbox-1',
    title: 'Confirm the MSA redlines are final before signature',
    loopType: 'approval',
    confidence: 0.72,
    priorityLabel: 'P1',
    whyPriority: 'Blocks the contract from going out this week.',
    evidence: {
      sourceApp: 'gmail',
      author: 'legal@acme.com',
      occurredAt: '2026-07-12T15:20:00.000Z',
      excerpt: 'Can you confirm the MSA redlines are final before we send it out for signature?',
    },
  },
  {
    id: 'loop-inbox-2',
    title: 'Decide on the Q3 hiring plan for the design team',
    loopType: 'decision',
    confidence: 0.68,
    priorityLabel: 'P2',
    whyPriority: 'Waiting on you before the recruiter posts the role.',
    evidence: {
      sourceApp: 'slack',
      author: 'Jordan (Head of Design)',
      occurredAt: '2026-07-11T18:04:00.000Z',
      excerpt: 'Once you sign off on the plan I can get the req posted this week.',
    },
  },
  {
    id: 'loop-inbox-3',
    title: 'Follow up with the Series A lead on the term sheet',
    loopType: 'follow-up',
    confidence: 0.61,
    priorityLabel: 'P1',
    whyPriority: "It's been five days since their last message.",
    evidence: {
      sourceApp: 'gmail',
      author: 'sam@northlightcapital.com',
      occurredAt: '2026-07-08T13:45:00.000Z',
      excerpt: "We'd love to move quickly once you've had a chance to review the term sheet.",
    },
  },
];

export const mockWaitingLoops = [
  {
    id: 'loop-waiting-1',
    title: 'Q2 sales numbers for the board deck',
    loopType: 'request',
    counterpartyName: 'Priya (Head of Sales)',
    createdAt: '2026-07-08T09:00:00.000Z',
    dueAt: '2026-07-14T00:00:00.000Z',
    evidence: {
      sourceApp: 'slack',
      excerpt: "I'll get you the Q2 numbers by end of week.",
    },
  },
  {
    id: 'loop-waiting-2',
    title: 'Signed offer letter from the new hire',
    loopType: 'waiting',
    counterpartyName: 'Marcus Webb (candidate)',
    createdAt: '2026-07-10T16:30:00.000Z',
    dueAt: null,
    evidence: {
      sourceApp: 'gmail',
      excerpt: "Thanks, I'll review this over the weekend and send it back signed.",
    },
  },
];
