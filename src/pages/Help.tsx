import { ResponsiveLayout } from "@/components/ResponsiveLayout";

const Help = () => {
  return (
    <ResponsiveLayout>
      <div className="max-w-2xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">Help</h1>
        <p className="text-muted-foreground">
          If you have any questions or need assistance, please contact our support team at{' '}
          <a href="mailto:support@myarchepal.com" className="text-primary underline">
            support@myarchepal.com
          </a>
        </p>
      </div>
    </ResponsiveLayout>
  );
};

export default Help;
