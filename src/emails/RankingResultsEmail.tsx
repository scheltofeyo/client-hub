import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

export interface RankingResultsEmailMatch {
  kind: "pair";
  partnerName: string;
}

export interface RankingResultsEmailTrio {
  kind: "trio";
  partnerNames: [string, string];
}

export interface RankingResultsEmailNoMatch {
  kind: "none";
}

export type RankingResultsEmailMatchInfo =
  | RankingResultsEmailMatch
  | RankingResultsEmailTrio
  | RankingResultsEmailNoMatch;

export interface RankingResultsEmailProps {
  participantName: string;
  sessionTitle: string;
  rankedValues: { title: string; mantra?: string; color?: string }[];
  resultsUrl: string;
  senderLabel?: string;
  match?: RankingResultsEmailMatchInfo;
}

const styles = {
  body: { backgroundColor: "#f4f4f5", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
  container: { maxWidth: "560px", margin: "0 auto", padding: "32px 24px" },
  card: { backgroundColor: "#ffffff", borderRadius: "12px", padding: "28px", border: "1px solid #e4e4e7" },
  brand: { fontSize: "12px", fontWeight: 600, color: "#7c3aed", letterSpacing: "0.08em", textTransform: "uppercase" as const, margin: 0 },
  heading: { fontSize: "20px", fontWeight: 600, color: "#0f172a", margin: "8px 0 4px 0" },
  subheading: { fontSize: "14px", color: "#52525b", margin: "0 0 20px 0", lineHeight: "20px" },
  text: { fontSize: "14px", color: "#0f172a", lineHeight: "20px", margin: "0 0 16px 0" },
  sectionLabel: {
    fontSize: "11px",
    fontWeight: 600,
    color: "#71717a",
    letterSpacing: "0.06em",
    textTransform: "uppercase" as const,
    margin: "0 0 8px 0",
  },
  valueRow: {
    fontSize: "14px",
    color: "#0f172a",
    margin: "0 0 4px 0",
    padding: "8px 12px",
    borderRadius: "8px",
    backgroundColor: "#fafafa",
    lineHeight: "20px",
  },
  rank: { display: "inline-block" as const, width: "20px", color: "#71717a", fontWeight: 600 },
  swatch: {
    display: "inline-block" as const,
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    marginRight: "8px",
    verticalAlign: "middle" as const,
  },
  valueTitle: { fontWeight: 500, color: "#0f172a" },
  valueMantra: { color: "#71717a", marginLeft: "4px" },
  matchCard: {
    backgroundColor: "#f5f3ff",
    border: "1px solid #ddd6fe",
    borderRadius: "10px",
    padding: "14px 16px",
    margin: "0 0 20px 0",
  },
  matchPartner: { fontSize: "16px", fontWeight: 600, color: "#0f172a", margin: "0 0 2px 0" },
  matchMeta: { fontSize: "12px", color: "#71717a", margin: 0 },
  cta: {
    display: "inline-block" as const,
    backgroundColor: "#7c3aed",
    color: "#ffffff",
    padding: "10px 20px",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: 500,
    textDecoration: "none",
    margin: "0",
  },
  divider: { borderColor: "#e4e4e7", margin: "20px 0" },
  footer: { fontSize: "12px", color: "#a1a1aa", marginTop: "24px", textAlign: "center" as const },
};

function MatchSection({ match }: { match: RankingResultsEmailMatchInfo }) {
  if (match.kind === "pair") {
    return (
      <Section style={styles.matchCard}>
        <Text style={styles.sectionLabel}>Your match</Text>
        <Text style={styles.matchPartner}>{match.partnerName}</Text>
      </Section>
    );
  }
  if (match.kind === "trio") {
    return (
      <Section style={styles.matchCard}>
        <Text style={styles.sectionLabel}>Your group</Text>
        <Text style={styles.matchPartner}>
          {match.partnerNames[0]} & {match.partnerNames[1]}
        </Text>
        <Text style={styles.matchMeta}>An odd number of participants — discuss the values together.</Text>
      </Section>
    );
  }
  return (
    <Section style={styles.matchCard}>
      <Text style={styles.sectionLabel}>Your match</Text>
      <Text style={styles.matchMeta}>No match was assigned — your facilitator can pair you up directly.</Text>
    </Section>
  );
}

export default function RankingResultsEmail({
  participantName,
  sessionTitle,
  rankedValues,
  resultsUrl,
  senderLabel,
  match,
}: RankingResultsEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Your ranking results for {sessionTitle}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.card}>
            <Text style={styles.brand}>SUMM Hub</Text>
            <Heading style={styles.heading}>Hi {participantName},</Heading>
            <Text style={styles.subheading}>
              Here are your ranked values from <strong>{sessionTitle}</strong>, in priority order.
            </Text>

            {match ? <MatchSection match={match} /> : null}

            <Text style={styles.sectionLabel}>Your ranking</Text>
            <Section>
              {rankedValues.map((v, i) => (
                <Text key={i} style={styles.valueRow}>
                  <span style={styles.rank}>{i + 1}.</span>
                  {v.color ? <span style={{ ...styles.swatch, backgroundColor: v.color }} /> : null}
                  <span style={styles.valueTitle}>{v.title}</span>
                  {v.mantra ? <span style={styles.valueMantra}>— {v.mantra}</span> : null}
                </Text>
              ))}
            </Section>

            <Hr style={styles.divider} />

            <Text style={{ ...styles.text, marginBottom: "12px" }}>You can revisit these results at any time:</Text>
            <Button href={resultsUrl} style={styles.cta}>
              View full results
            </Button>

            {senderLabel ? (
              <Text style={{ ...styles.text, color: "#71717a", marginTop: "20px", marginBottom: 0 }}>
                Sent by {senderLabel}.
              </Text>
            ) : null}
          </Section>
          <Text style={styles.footer}>
            You received this email because you participated in a Ranking the Values workshop on SUMM Hub.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
