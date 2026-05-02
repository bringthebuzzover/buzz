/**
 * Student org registration landing: narrow centered headline plus `RegisterForm` (demo submit → `/campaigns`).
 */
import RegisterForm from "../../components/register/RegisterForm";

export default function RegisterPage() {
  return (
    <div className="mx-auto max-w-2xl px-8 py-12">
      <div className="mb-8 text-center">
        <h2 className="mb-2 text-3xl font-bold text-buzz-coral">
          Register Your Campus Group
        </h2>
        <p className="text-sm font-medium text-buzz-inkMuted">
          Join our network to receive PR and host pop-ups for top brands.
        </p>
      </div>
      <RegisterForm />
    </div>
  );
}
