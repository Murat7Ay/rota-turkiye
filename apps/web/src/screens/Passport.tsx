// Türkiye Pasaportu: damgalar, il haritası ve gezi özeti (Wrapped).
import { useMemo } from "react";
import { PassportScreen } from "../features/passport";
import { EmptyState, Button, Spinner } from "../components/ui";
import { navigate } from "../app/router";
import { usePlanData } from "../state/hooks";
import { useTrip } from "../state/trip";

export default function Passport() {
  const { plan, index } = usePlanData();
  const expenses = useTrip((s) => s.expenses);
  const trips = useMemo(() => (plan ? [{ plan, expenses: expenses.filter((e) => e.tripId === plan.id) }] : []), [plan, expenses]);

  if (!plan) {
    return (
      <EmptyState emoji="🛂" title="Türkiye Pasaportu" action={<Button variant="primary" onClick={() => navigate("olustur")}>Gezi oluştur</Button>}>
        Gittiğin her yer bir damga: Çay Ustası, Antik Kent Avcısı, Esnaf Lokantası Müdavimi… 81 ilin haritası da gezdikçe dolar.
      </EmptyState>
    );
  }
  if (!index) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="size-7" />
      </div>
    );
  }
  return <PassportScreen trips={trips} index={index} />;
}
