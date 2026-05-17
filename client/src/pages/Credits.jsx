import React, { useCallback, useEffect, useState } from 'react'
import Loading from './Loading'
import { useAppContext } from '../context'
import toast from 'react-hot-toast'
import { assets } from '../assets/assets'

const Credits = () => {
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const { token, axios, fetchUser } = useAppContext()

  const fetchPlans = useCallback(async () => {
    try {
      setLoading(true)
      const { data } = await axios.get('/api/credit/plan', {
        headers: { Authorization: token }
      })
      if (data.success) {
        setPlans(data.plans)
      } else {
        toast.error(data.message || 'Failed to fetch plans')
      }
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [axios, token])

  const purchasePlan = useCallback(async (planId) => {
    try {
      const { data } = await axios.post(
        '/api/credit/purchase',
        { planId },
        { headers: { Authorization: token } }
      )
      if (data.success) {
        window.location.assign(data.url)
      } else {
        toast.error(data.message)
      }
    } catch (err) {
      toast.error(err.message)
    }
  }, [axios, token])

  useEffect(() => {
    const t = setTimeout(fetchPlans, 0)
    return () => clearTimeout(t)
  }, [fetchPlans])

  if (loading) return <Loading />

  return (
    <div className="
      w-full h-full overflow-y-auto
      bg-bg relative
      px-6 py-16 md:px-12 xl:px-24
      text-text custom-scrollbar
    ">
      {/* Aesthetic Background */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-96 bg-accent/5 blur-[120px] rounded-full -z-10" />

      {/* Header Section */}
      <div className="text-center mb-16 animate-fade-in">
        <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-6 text-text leading-[1.1]">
          Fuel your <span className="text-gradient underline decoration-accent/10 underline-offset-8">creativity</span>
        </h1>
        <p className="text-lg text-muted/80 max-w-2xl mx-auto font-semibold leading-relaxed px-4 mb-8">
          Scale your productivity with flexible neural packages. No recurring fees, just pure power when you need it.
        </p>

        <button
          onClick={() => {
            toast.promise(fetchUser({ silent: true }), {
              loading: 'Checking server for latest balance…',
              success: 'Balance synchronized',
              error: 'Sync failed'
            })
          }}
          className="text-[10px] font-black uppercase tracking-[0.2em] px-6 py-2.5 rounded-full border border-accent/20 bg-accent/5 hover:bg-accent hover:text-white transition-all duration-300"
        >
          ↻ Sync Balance
        </button>
      </div>

      {/* Modern Plans Grid */}
      <div className="
        grid gap-8
        grid-cols-1
        sm:grid-cols-2
        lg:grid-cols-3
        max-w-6xl mx-auto
      ">
        {plans.map(plan => {
          const isPopular = plan._id === 'pro'

          return (
            <div
              key={plan._id}
              className={`
                group relative flex flex-col
                glass rounded-[2rem]
                p-8 shadow-premium overflow-hidden
                transition-all duration-500 hover:-translate-y-2
                ${isPopular ? 'border-accent/40 ring-1 ring-accent/20' : 'border-border/50'}
              `}
            >
              {/* Popular Glow Effect */}
              {isPopular && (
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-accent/20 blur-3xl rounded-full group-hover:bg-accent/30 transition-colors" />
              )}

              {/* Package Identification */}
              <div className="mb-8">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-2xl font-bold tracking-tight">
                    {plan.name}
                  </h3>
                  {isPopular && (
                    <span className="
                      px-3 py-1 bg-accent text-white text-[10px] font-black uppercase tracking-widest rounded-full
                    ">
                      Recommended
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted font-medium">Professional grade access</p>
              </div>

              {/* Pricing Display */}
              <div className="mb-8">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold tracking-tighter">${plan.price}</span>
                  <span className="text-muted text-sm font-semibold uppercase tracking-widest">/ once</span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="w-5 h-5 bg-accent/10 rounded-md flex items-center justify-center">
                    <img src={assets.diamond_icon} className="w-3 invert dark:invert-0 opacity-60" />
                  </div>
                  <span className="text-sm font-bold text-accent">{plan.credits} Credits included</span>
                </div>
              </div>

              {/* Capability List */}
              <ul className="flex-1 space-y-4 mb-10">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex gap-3 items-center group/item">
                    <div className="w-5 h-5 rounded-full bg-accent/10 flex items-center justify-center shrink-0 group-hover/item:bg-accent group-hover/item:text-white transition-colors">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-sm font-semibold text-text/80 group-hover/item:text-text transition-colors">
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              {/* Call to action */}
              <button
                onClick={() =>
                  toast.promise(
                    purchasePlan(plan._id),
                    { loading: 'Synchronizing with payment gateway…' }
                  )
                }
                className={`
                  w-full py-4 rounded-2xl text-sm font-black uppercase tracking-widest
                  transition-all duration-300 shadow-lg active:scale-95
                  ${isPopular
                    ? 'bg-accent text-white hover:shadow-accent/40'
                    : 'bg-text text-bg hover:opacity-90'
                  }
                `}
              >
                Access {plan.name}
              </button>
            </div>
          )
        })}
      </div>

      {/* Trust Indicator */}
      <div className="mt-20 pt-10 border-t border-border/10">
        <p className="text-center text-[11px] font-black text-muted uppercase tracking-widest opacity-40">
          Secure encrypted transactions • All credits valid indefinitely
        </p>
      </div>
    </div>
  )
}

export default Credits
