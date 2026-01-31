import React, { useEffect, useState } from 'react'
import Loading from './Loading'
import { useAppContext } from '../context/AppContext'
import toast from 'react-hot-toast'

const Credits = () => {
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const { token, axios } = useAppContext()

  const fetchPlans = async () => {
    try {
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
  }

  const purchasePlan = async (planId) => {
    try {
      const { data } = await axios.post(
        '/api/credit/purchase',
        { planId },
        { headers: { Authorization: token } }
      )
      if (data.success) {
        window.location.href = data.url
      } else {
        toast.error(data.message)
      }
    } catch (err) {
      toast.error(err.message)
    }
  }

  useEffect(() => {
    fetchPlans()
  }, [])

  if (loading) return <Loading />

  return (
    <div className="
      w-full h-full overflow-y-auto
      bg-[#0d1117]
      px-6 py-12 md:px-12 xl:px-20
      text-gray-200
    ">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-3xl font-semibold tracking-tight">
          Credit Plans
        </h1>
        <p className="text-sm text-gray-500 mt-2">
          Pay only for what you use. No subscriptions.
        </p>
      </div>

      {/* Plans */}
      <div className="
        grid gap-8
        grid-cols-1
        sm:grid-cols-2
        lg:grid-cols-3
        justify-center
        max-w-6xl mx-auto
      ">
        {plans.map(plan => {
          const isPopular = plan._id === 'pro'

          return (
            <div
              key={plan._id}
              className={`
                flex flex-col
                bg-[#161b22]
                border rounded-md
                p-6
                transition
                ${isPopular
                  ? 'border-[#7aa2f7]'
                  : 'border-[#30363d]'
                }
              `}
            >
              {/* Plan name */}
              <div className="mb-4">
                <h3 className="text-lg font-medium">
                  {plan.name}
                </h3>
                {isPopular && (
                  <span className="
                    inline-block mt-1
                    text-xs text-[#7aa2f7]
                  ">
                    Most used
                  </span>
                )}
              </div>

              {/* Price */}
              <div className="mb-5">
                <p className="text-3xl font-semibold">
                  ${plan.price}
                </p>
                <p className="text-sm text-gray-500">
                  {plan.credits} credits
                </p>
              </div>

              {/* Features */}
              <ul className="flex-1 space-y-2 text-sm text-gray-300">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex gap-2">
                    <span className="text-[#7aa2f7]">•</span>
                    {feature}
                  </li>
                ))}
              </ul>

              {/* Action */}
              <button
                onClick={() =>
                  toast.promise(
                    purchasePlan(plan._id),
                    { loading: 'Redirecting to checkout…' }
                  )
                }
                className={`
                  mt-6 py-2 rounded-md text-sm font-medium
                  transition
                  ${isPopular
                    ? 'bg-[#7aa2f7] text-black hover:opacity-90'
                    : 'border border-[#30363d] hover:bg-[#1f2937]'
                  }
                `}
              >
                Buy credits
              </button>
            </div>
          )
        })}
      </div>

      {/* Footer note */}
      <p className="mt-12 text-center text-xs text-gray-500">
        Credits never expire. Use them anytime.
      </p>
    </div>
  )
}

export default Credits
