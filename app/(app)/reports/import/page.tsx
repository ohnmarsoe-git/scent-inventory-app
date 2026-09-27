import { ImportWizard } from "@/components/reports/import-wizard";
import { PageHeader } from "@/components/ui/page-header";

export default function ImportPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        title="Import CSV"
        description="Preview and validate before inserting. Never imports without confirmation."
        backHref="/reports"
        backLabel="Reports"
      />
      <ImportWizard />
    </div>
  );
}
