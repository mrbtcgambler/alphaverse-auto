import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns

# For Jupyter Notebook plotting (remove if not in a notebook)
# %matplotlib inline

data = {
    'VIP Level': [
        'Bronze','Silver','Gold',
        'Platinum 1','Platinum 2','Platinum 3','Platinum 4','Platinum 5','Platinum 6',
        'Diamond 1','Diamond 2','Diamond 3','Diamond 4','Diamond 5',
        'Obsidian 1'
    ],
    'Wager Requirement': [
        10_000, 50_000, 100_000,
        250_000, 500_000, 1_000_000, 2_500_000, 5_000_000, 10_000_000,
        25_000_000, 50_000_000, 100_000_000, 250_000_000, 500_000_000,
        1_000_000_000
    ],
    'Difference_from_previous': [
        10_000, 40_000, 50_000, 
        150_000, 250_000, 500_000, 1_500_000, 2_500_000, 5_000_000,
        15_000_000, 25_000_000, 50_000_000, 150_000_000, 250_000_000,
        500_000_000
    ],
    'Payout': [
        30, 55, 110,
        220, 440, 880, 1760, 3520, 7040,
        14080, 28160, 56320, 112640, 225280,
        450560
    ]
}

df = pd.DataFrame(data)
df

df['Ratio_Diff_to_Payout'] = df['Difference_from_previous'] / df['Payout']
df

df[['VIP Level', 'Difference_from_previous', 'Payout', 'Ratio_Diff_to_Payout']]

def net_ev_to_next_level(difference, payout, x, win_prob=0.99):
    """
    difference: how much wagering is needed from the previous VIP to this one
    payout: the reward upon achieving this level
    x: fraction already completed toward difference
    win_prob: probability of winning each $1 bet
    """
    # Bets needed to finish crossing the threshold
    bets_needed = (1 - x) * difference
    
    # Expected cost per bet = 1 - win_prob
    exp_cost_per_bet = 1 - win_prob
    
    # Total expected cost in dollar terms
    total_expected_cost = bets_needed * exp_cost_per_bet
    
    # Net EV once we cross
    return payout - total_expected_cost

xs = [0.50, 0.70, 0.85, 0.90, 0.95]  # fractions of progress to test
win_prob = 0.99

results = []
for i, row in df.iterrows():
    D = row['Difference_from_previous']
    P = row['Payout']
    
    for x in xs:
        ev = net_ev_to_next_level(D, P, x, win_prob=win_prob)
        results.append({
            'VIP Level': row['VIP Level'],
            'Already_Completed_%': x,
            'Difference': D,
            'Payout': P,
            'Net_EV': ev
        })

results_df = pd.DataFrame(results)
results_df.head(10)

plt.figure(figsize=(10,6))
sns.barplot(
    data=results_df[results_df['Already_Completed_%'].isin([0.85])], 
    x='VIP Level', 
    y='Net_EV'
)
plt.axhline(0, color='red', linestyle='--', linewidth=1)
plt.xticks(rotation=45, ha='right')
plt.title("Net EV at 85% Already Completed (win_prob=0.99)")
plt.tight_layout()
plt.show()

plt.figure(figsize=(12,6))
sns.barplot(
    data=results_df,
    x='VIP Level',
    y='Net_EV',
    hue='Already_Completed_%'
)
plt.axhline(0, color='red', linestyle='--', linewidth=1)
plt.xticks(rotation=45, ha='right')
plt.title("Net EV for Different Already-Completed Fractions")
plt.tight_layout()
plt.show()

silver_gold_diff = 50_000
silver_gold_payout = 110
x = 0.85

bets_needed = (1 - x)*silver_gold_diff
expected_loss = bets_needed * 0.01
net_ev = silver_gold_payout - expected_loss

net_ev


