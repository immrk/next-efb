import { type FormEvent, useState } from "react"
import { Layers3, LoaderCircle, LogIn, UserPlus } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { login } from "@/service"

export function LoginBox() {
  const { t } = useTranslation()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault()
    const nextErrors: { email?: string; password?: string } = {}
    if (!email) nextErrors.email = t("login.validation.emailRequired")
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) nextErrors.email = t("login.validation.emailInvalid")
    if (!password) nextErrors.password = t("login.validation.passwordRequired")
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setLoading(true)
    try {
      const result = await login({ email, password })
      await window.auth.login(result)
      toast.success(t("login.messages.success"))
      window.setTimeout(() => void window.windowManager.closeWindow("login"), 500)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("login.messages.failed"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex h-full items-center justify-center px-8 pt-[30px]">
      <div className="w-full max-w-sm">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <Layers3 className="size-7" />
          </div>
          <h1 className="text-2xl font-semibold">{t("login.title")}</h1>
        </div>

        <form className="space-y-5" noValidate onSubmit={(event) => void handleLogin(event)}>
          <div className="space-y-2">
            <Label htmlFor="email">{t("login.email")}</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              aria-invalid={Boolean(errors.email)}
              onChange={(event) => setEmail(event.target.value)}
            />
            {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">{t("login.password")}</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              aria-invalid={Boolean(errors.password)}
              onChange={(event) => setPassword(event.target.value)}
            />
            {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
          </div>

          <div className="flex gap-3 pt-1">
            <Button className="flex-1" type="submit" disabled={loading}>
              {loading ? <LoaderCircle className="animate-spin" /> : <LogIn />}
              {t("login.login")}
            </Button>
            <Button
              className="flex-1"
              type="button"
              variant="outline"
              onClick={() => toast.warning(t("login.messages.registerUnavailable"))}
            >
              <UserPlus />
              {t("login.register")}
            </Button>
          </div>
        </form>
      </div>
    </main>
  )
}
