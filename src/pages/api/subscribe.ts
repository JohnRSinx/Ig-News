import { NextApiRequest, NextApiResponse } from 'next';
import { query as q } from 'faunadb'
import { getSession } from 'next-auth/react';
import { fauna } from '../../services/fauna';
import { stripe } from '../../services/stripe';

interface IStripe {
  id: string;
  object: string;
  balance: number;
  created: number,
  delinquent: false;
  email: string;
  invoice_prefix: string;
  invoice_settings: object;
  livemode: boolean,
  metadata: object,
  next_invoice_sequence: number;
  preferred_locales: object;
  tax_exempt: string
}
type User = {
  ref : {
    id: string;
  }
  data: {
    stripe_customer_id:IStripe;
  }
}

export default async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method === 'POST') {

    const session = await getSession({ req })

    const user =  await fauna.query<User>(
      q.Get(
        q.Match(
          q.Index('user_by_email'),
          q.Casefold(session.user.email)
        )
      )
    );
    let  customerId = user.data.stripe_customer_id.id;
       
    if(!customerId) {
      
      const stripeCustomer = await stripe.customers.create({
        email: session.user.email,
        //metadata
      
      })
      await fauna.query(
        q.Update(
          q.Ref(q.Collection('users'),user.ref.id),
          {
            data :{ 
              stripe_customer_id : stripeCustomer
            }
          }
        )
        )
        customerId=  stripeCustomer.id
        
    }
    
    console.log(customerId);
  
    const stripeCheckoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      billing_address_collection: 'required',
      line_items: [
        {
          price: 'price_1KRefWCgMm1XdkgAkxY9a7hQ',
          quantity: 1,
        },
      ],
      mode: 'subscription',
      allow_promotion_codes: true,
      success_url: process.env.STRIPE_SUCCESS_URL,
      cancel_url: process.env.STRIPE_CANCEL_URL,
    })

    return res.status(200).json({ sessionId: stripeCheckoutSession.id });
  } else {
    res.setHeader('Allow', 'POST');
    res.status(405).end('Method not allowed');
  }
};






